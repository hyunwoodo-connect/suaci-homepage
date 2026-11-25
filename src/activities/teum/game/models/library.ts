import * as THREE from "three";

import type { Manifest } from "@/lib/asset-kit/manifest";
import { paintAvatar } from "@/lib/avatar/paint";
import { AVATAR_BODY, isAvatarModel } from "@/lib/avatar/parts";

import { MODEL_BAKE } from "../../assets/settings";
import type { LookUniforms } from "../look";
import type { Dip } from "../world/culler";
import type { Sight } from "../world/sight";
import { ModelBatch } from "./batch";
import { extentBy } from "./extent";
import { Instancer } from "./instancer";
import { StaticPack } from "./staticPack";
import type { MotionUniforms } from "./shader";
import { styleModel } from "./shader";

// 모델 자리: 배치는 manifest 의 크기 상자(원본 기준)로 먼저 끝내고, 모양은 모델이 도착하면 그 자리에 끼운다.
// 받는 순서가 배치를 흔들지 않고, 아직 안 온 것은 도형(prim)이 대신 서 있다가 모델이 오면 숨는다.
// 재질은 키마다 한 번만 칠해 같이 쓴다(틀마다 복제하지 않는다). 저마다 라임으로 물들어야 하는 틀만 제 재질을 갖는다

/** fit 이 만든 모델 틀이 갖는 값 */
interface HoldData {
  /** 틀의 배율 */
  k: number;
  /** 키의 절반(바닥을 땅에 붙이는 높이) */
  hh: number;
  /** 너비의 절반 */
  rw: number;
  /** 라임으로 물드는 정도(제 재질이 없으면 키마다 같이 쓰는 0) */
  uLime: { value: number };
  /** 관람차처럼 여러 부품으로 세운 것: 꼭대기·도는 바퀴·부품 */
  top?: number;
  spin?: THREE.Group;
  parts?: Hold[];
}

/** 모델 틀(빈 그룹으로 먼저 놓이고 모델이 오면 채워진다) */
export type Hold = THREE.Group & { userData: HoldData };

/** fit 의 선택 */
interface FitOptions {
  /** 저마다 라임으로 물든다(제 재질을 갖는다) */
  ownLime?: boolean;
  /** 모델이 끼워진 직후 */
  onArrive?: (model: THREE.Object3D) => void;
}

/** 키마다 같이 쓰는 셰이더 값: 라임(늘 0)과 몸 휘기(날개처럼 모두 같이 휘는 것) */
interface KeyShared {
  lime: { value: number };
  motion: MotionUniforms;
}

/** 모델 받기·끼우기 */
export class ModelLibrary {
  /** 아직 안 온 키 → 기다리는 것 */
  readonly waiting = new Map<string, ((root: THREE.Group) => void)[]>();
  readonly arrived = new Map<string, THREE.Group>();
  private readonly shared = new Map<string, KeyShared>();
  /** 여러 개 찍는 묶음이 쓰는 재질(낱개 틀의 재질과 따로, 키의 같은 값으로 칠한다) */
  private readonly instMats = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  private readonly instancers: Instancer[] = [];
  private readonly batches: ModelBatch[] = [];
  private readonly packs: StaticPack[] = [];
  /** 놓인 자리(첫 화면에 받을 모델을 고르는 데 쓴다): 틀, 여러 번 찍는 묶음, 한꺼번에 그리는 묶음의 자리 */
  private readonly holds: { k: string; hold: THREE.Object3D }[] = [];
  private readonly batchSpots: { k: string; spots: readonly THREE.Vector3[] }[] = [];
  /** 첫 화면·뒤 받기 밖에서 필요해진 모델(갈아입는 부품)을 받아 오는 창구. 달기 전에 부탁한 것은 모아 둔다 */
  private requester: ((k: string) => void) | null = null;
  private readonly asked = new Set<string>();
  private disposed = false;
  /** 도착했지만 아직 GPU 에 올리지 않은 그림(텍스처) */
  private readonly cold: THREE.Texture[] = [];

  constructor(
    readonly manifest: Manifest,
    private readonly lookU: LookUniforms,
    private readonly scene: THREE.Scene,
  ) {}

  /** 이 모델이 manifest 에 있나 */
  has(k: string): boolean {
    return Boolean(this.manifest.assets[k]?.box);
  }

  /** 원본 크기 상자 */
  box(k: string): THREE.Box3 {
    const b = this.manifest.assets[k].box!;
    const min = new THREE.Vector3(b[0], b[1], b[2]),
      max = new THREE.Vector3(b[3], b[4], b[5]);
    return new THREE.Box3(min, max);
  }

  /** 받아 오는 창구를 단다(게임을 시작할 때). 그 전에 부탁한 것도 이때 받는다 */
  useRequester(fn: (k: string) => void) {
    this.requester = fn;
    for (const k of this.asked) if (!this.arrived.has(k)) fn(k);
  }

  /** 받아 오지 못했다 — 다음에 필요해지면 다시 부탁한다 */
  failed(k: string) {
    this.asked.delete(k);
  }

  /** 이 모델이 지금 필요하다: 아직 안 왔으면 받아 달라고 한 번 부탁한다 */
  need(k: string) {
    if (!this.has(k) || this.arrived.has(k) || this.asked.has(k)) return;
    this.asked.add(k);
    this.requester?.(k);
  }

  /** 모델이 오면(이미 왔으면 바로) cb */
  when(k: string, cb: (root: THREE.Group) => void) {
    const root = this.arrived.get(k);
    if (root) {
      cb(root);
      return;
    }
    const list = this.waiting.get(k) ?? [];
    list.push(cb);
    this.waiting.set(k, list);
  }

  /** 모델이 오면 도형(prims)을 숨긴다 */
  swapWhenReady(k: string, prims: readonly THREE.Object3D[]) {
    this.when(k, () => {
      for (const o of prims) o.visible = false;
    });
  }

  /** 키마다 같이 쓰는 몸 휘기 값(날개처럼 모두 같은 박자로 휘는 것이 쓴다) */
  motionOf(k: string): MotionUniforms {
    return this.sharedOf(k).motion;
  }

  /** 받은 모델을 넘긴다: 앞이 +x 를 보게 돌려 두고, 키의 재질을 한 번 칠하고, 기다리던 자리를 채운다 */
  deliver(k: string, root: THREE.Group) {
    // 같은 키가 두 길(첫 화면·뒤 받기와 need)로 와도 한 번만, 치운 뒤에 온 것은 버린다
    if (this.disposed || this.arrived.has(k)) return;
    const bake = MODEL_BAKE[k];
    if (bake) {
      const bakeTurn = new THREE.Euler(...bake),
        bm = new THREE.Matrix4().makeRotationFromEuler(bakeTurn);
      root.traverse((c) => {
        if (c instanceof THREE.Mesh) c.geometry.applyMatrix4(bm);
      });
    }
    root.traverse((c) => {
      if (c instanceof THREE.Mesh) this.paint(k, c.material as THREE.MeshStandardMaterial);
    });
    root.updateMatrixWorld(true);
    this.arrived.set(k, root);
    this.chill(root);
    const list = this.waiting.get(k) ?? [];
    this.waiting.delete(k);
    for (const cb of list) cb(root);
  }

  /**
   * 도착했지만 아직 GPU 에 올리지 않은 그림 하나(없으면 undefined). 그림은 처음 그려지는 순간에 올라가는데, 그때 올리면 그 프레임이
   * 끊긴다 — 게임이 프레임마다 하나씩 꺼내 미리 올린다
   */
  takeCold(): THREE.Texture | undefined {
    return this.cold.shift();
  }

  /** 도착했지만 아직 GPU 에 올리지 못한 그림이 남았나 */
  get hasCold(): boolean {
    return this.cold.length > 0;
  }

  /**
   * 모델 틀: 크기 1 쯤·정면 +x 로 통일된 모델을 원하는 크기(by: h 키, w 너비, x·z 그 축)로 맞추고 가운데를 원점에 둔다.
   * 틀의 값(배율·키·너비)은 원본 상자로 정하고, 모델은 도착하면 끼운다(돌려 둔 모델은 도착할 때 다시 잰다)
   */
  fit(k: string, size: number, by: string, opts: FitOptions = {}): Hold {
    const box = this.box(k),
      sz = new THREE.Vector3(),
      ct = new THREE.Vector3();
    box.getSize(sz);
    box.getCenter(ct);
    const hold = new THREE.Group() as Hold;
    this.holds.push({ k, hold });
    const extent = extentBy(sz, by);
    const s = size / extent;
    hold.scale.setScalar(s);
    const lime = opts.ownLime ? { value: 0 } : this.sharedOf(k).lime;
    hold.userData = { k: s, hh: (sz.y * s) / 2, rw: (Math.max(sz.x, sz.z) * s) / 2, uLime: lime };
    this.when(k, (root) => {
      const o = root.clone(true);
      if (opts.ownLime) this.ownMaterials(o, k, lime);
      const center = ct.clone();
      if (MODEL_BAKE[k]) {
        const b2 = new THREE.Box3().setFromObject(o),
          sz2 = new THREE.Vector3();
        b2.getSize(sz2);
        b2.getCenter(center);
        const extent2 = extentBy(sz2, by);
        const s2 = size / extent2;
        hold.scale.setScalar(s2);
        Object.assign(hold.userData, {
          k: s2,
          hh: (sz2.y * s2) / 2,
          rw: (Math.max(sz2.x, sz2.z) * s2) / 2,
        });
      }
      o.position.sub(center);
      hold.add(o);
      opts.onArrive?.(o);
    });
    return hold;
  }

  /** 모델 하나를 n 번까지 찍는 묶음(키 1·바닥이 원점). 모델이 manifest 에 없으면 null */
  inst(k: string, n: number): Instancer | null {
    if (!this.has(k)) return null;
    const box = this.box(k);
    const I = new Instancer(k, n, box);
    this.when(k, (root) => I.build(root, this.scene, (m) => this.instancedMaterial(k, m)));
    this.instancers.push(I);
    return I;
  }

  /**
   * 같은 모델을 여럿 그리되 저마다 몸 휘기·라임이 다른 묶음(생물·별·범퍼). 없으면 null.
   * spots: 움직이지 않는 것이면 그 자리들(첫 화면에 받을지 고르는 데 쓴다)
   */
  batch(
    k: string,
    capacity: number,
    size: number,
    by: string,
    motionKind = 0,
    spots: readonly THREE.Vector3[] = [],
  ): ModelBatch | null {
    if (!this.has(k)) return null;
    this.batchSpots.push({ k, spots });
    const box = this.box(k),
      baked = Boolean(MODEL_BAKE[k]);
    const B = new ModelBatch(k, capacity, box, size, by, baked);
    this.when(k, (root) => B.build(root, this.scene, this.lookU, motionKind));
    this.batches.push(B);
    return B;
  }

  /** 가까운 것을 고른다(찍어 둔 묶음): cosCut 보다 가깝고, 눈(eye)에서 지평선 너머가 아닌 것만 */
  cull(p: THREE.Vector3, cosCut: number, eye: Dip) {
    for (const I of this.instancers) I.cull(p, cosCut, eye);
  }

  /** 놓인 모델의 키와 행성 위 자리(틀은 지금 세계 자리, 묶음은 찍은 자리) — 첫 화면에 받을 것을 고른다 */
  placements(): { key: string; v: THREE.Vector3 }[] {
    const out: { key: string; v: THREE.Vector3 }[] = [];
    for (const { k, hold } of this.holds) {
      hold.updateWorldMatrix(true, false);
      const v = new THREE.Vector3().setFromMatrixPosition(hold.matrixWorld);
      // 아직 행성 위에 놓이지 않은 틀(아바타 몸에 붙은 것 등)은 원점 근처라 뺀다
      if (v.lengthSq() < 1) continue;
      v.normalize();
      out.push({ key: k, v });
    }
    for (const I of this.instancers) for (const v of I.spots()) out.push({ key: I.key, v });
    for (const { k, spots } of this.batchSpots) for (const v of spots) out.push({ key: k, v });
    return out;
  }

  /** 거의 움직이지 않는 도형 묶음(레일 구슬·쿠션 벽·뭉게구름…)을 시야 거르기에 맡긴다 */
  pack(mesh: THREE.InstancedMesh): StaticPack {
    const P = new StaticPack(mesh);
    this.packs.push(P);
    return P;
  }

  /** 그리기 직전: 모든 묶음에서 가까운 것(p 에서 cut 보다 가깝고 지평선 너머가 아닌 것) 가운데 시야 안의 것만 남긴다 */
  flush(sight: Sight, p: Readonly<THREE.Vector3>, cut: number, eye: Dip) {
    for (const I of this.instancers) I.flush(sight);
    for (const B of this.batches) B.flush(sight);
    for (const P of this.packs) P.flush(sight, p, cut, eye);
  }

  /** 찍어 둔 묶음·한꺼번에 그리는 묶음을 치운다 */
  dispose() {
    this.disposed = true;
    for (const I of this.instancers) I.dispose();
    for (const B of this.batches) B.dispose();
    for (const m of this.instMats.values()) m.dispose();
  }

  // 키의 재질을 한 번 칠한다. 나(아바타의 몸·끼우는 부품)는 어느 놀이에서든 같은 아바타의 칠을 쓴다 — 세상의 지역 색·물들기가 닿지 않는다
  private paint(k: string, mat: THREE.MeshStandardMaterial) {
    if (isAvatarModel(k)) {
      // 어떤 에셋의 재질인지(그리기 호출을 셀 때 이름으로 본다)
      mat.name = k;
      const outfit = k === AVATAR_BODY ? this.lookU.outfit : null;
      paintAvatar(mat, outfit);
      return;
    }
    const sh = this.sharedOf(k);
    styleModel(mat, { key: k, lookU: this.lookU, lime: sh.lime, motion: sh.motion, batch: false });
  }

  // 도착한 모델의 그림을 미리 올릴 줄에 세운다(같은 그림은 한 번만)
  private chill(root: THREE.Group) {
    root.traverse((c) => {
      if (!(c instanceof THREE.Mesh)) return;
      const mat = c.material as THREE.MeshStandardMaterial;
      for (const tex of [mat.map, mat.emissiveMap, mat.normalMap, mat.aoMap, mat.alphaMap])
        if (tex && !this.cold.includes(tex)) this.cold.push(tex);
    });
  }

  private sharedOf(k: string): KeyShared {
    let sh = this.shared.get(k);
    if (!sh) {
      sh = {
        lime: { value: 0 },
        motion: { uAn: { value: new THREE.Vector4() }, uAk: { value: 0 }, uAx: { value: 0 } },
      };
      this.shared.set(k, sh);
    }
    return sh;
  }

  // 찍는 묶음용 재질: 낱개 틀과 나눠 쓰면 그릴 때마다 셰이더가 바뀌어서 따로 둔다(라임·몸 휘기 값은 키의 것을 같이 쓴다)
  private instancedMaterial(k: string, m: THREE.Material): THREE.Material {
    const known = this.instMats.get(m);
    if (known) return known;
    const sh = this.sharedOf(k);
    const mat = (m as THREE.MeshStandardMaterial).clone();
    styleModel(mat, { key: k, lookU: this.lookU, lime: sh.lime, motion: sh.motion, batch: false });
    this.instMats.set(m, mat);
    return mat;
  }

  // 저마다 라임으로 물드는 틀: 재질을 복제해 제 라임 값으로 다시 칠한다
  private ownMaterials(o: THREE.Object3D, k: string, lime: { value: number }) {
    const motion = this.sharedOf(k).motion;
    o.traverse((c) => {
      if (!(c instanceof THREE.Mesh)) return;
      const mat = (c.material as THREE.MeshStandardMaterial).clone();
      styleModel(mat, { key: k, lookU: this.lookU, lime, motion, batch: false });
      c.material = mat;
    });
  }
}

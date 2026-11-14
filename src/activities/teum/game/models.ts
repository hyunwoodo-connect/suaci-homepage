import * as THREE from "three";

import type { Manifest } from "../assets/manifest";
import { CREATURES } from "../assets/settings";
import type { Game } from "./state";
import { applyLook } from "./world/look";
import { UP } from "./world/sphere";

// 모델 자리: 배치는 manifest 의 크기 상자(원본 기준)로 먼저 끝내고, 모양은 모델이 도착하면 그 자리에 끼운다.
// 받는 순서가 배치를 흔들지 않고, 아직 안 온 것은 도형(prim)이 대신 서 있다가 모델이 오면 숨는다

/** fit 이 만든 모델 틀이 갖는 값 */
export interface HoldData {
  /** 틀의 배율 */
  k: number;
  /** 키의 절반(바닥을 땅에 붙이는 높이) */
  hh: number;
  /** 너비의 절반 */
  rw: number;
  /** 라임으로 물드는 정도(셰이더 값) */
  uLime: { value: number };
  /** 별처럼 제자리에서 도는 것의 돌림 */
  yq: THREE.Quaternion;
  /** 관람차: 꼭대기·도는 바퀴·부품 */
  top?: number;
  spin?: THREE.Group;
  parts?: Hold[];
  /** 큰 공에 끼운 라임 */
  lime?: boolean;
}

/** 모델 틀(빈 그룹으로 먼저 놓이고 모델이 오면 채워진다) */
export type Hold = THREE.Group & { userData: HoldData };

/** 같은 모델을 여러 번 찍는 묶음 */
export interface Instancer {
  key: string;
  /** 모델의 메시마다 하나(모델이 오면 생긴다) */
  ims: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
  n: number;
  items: { M: THREE.Matrix4; slot: number; v: THREE.Vector3 }[];
  /** 키 1 일 때 너비의 절반 */
  rw: number;
  /** 지금 그리는 수(모델이 늦게 와도 같은 칸으로 채운다) */
  count: number;
  /** 늘 따라다니는 것(꼬마 라임)은 가까운 것만 그리기에서 뺀다 */
  noCull: boolean;
  /** 조형물 키(DECO 가 고른 종류) */
  gate?: boolean;
  add(m: THREE.Matrix4): number;
  set(i: number, m: THREE.Matrix4): void;
  cull(cosCut: number): void;
}

/** 모델 도착 대기열 */
export interface Models {
  manifest: Manifest;
  waiting: Map<string, ((root: THREE.Group) => void)[]>;
  arrived: Map<string, THREE.Group>;
  /** 여러 번 찍는 묶음 전체(가까운 것만 그리기) */
  insts: Instancer[];
}

/** manifest 를 보고 모델 대기열을 만든다 */
export function createModels(manifest: Manifest): Models {
  return { manifest, waiting: new Map(), arrived: new Map(), insts: [] };
}

/** 이 모델이 manifest 에 있나(시제품에서 모델이 불러와졌는지 보던 자리) */
export function hasModel(g: Game, k: string): boolean {
  return Boolean(g.models.manifest.assets[k]?.box);
}

/** 모델이 오면(이미 왔으면 바로) cb */
export function whenModel(g: Game, k: string, cb: (root: THREE.Group) => void) {
  const root = g.models.arrived.get(k);
  if (root) {
    cb(root);
    return;
  }
  const list = g.models.waiting.get(k) ?? [];
  list.push(cb);
  g.models.waiting.set(k, list);
}

/** 받은 모델을 넘긴다: 기다리던 자리를 채운다 */
export function deliverModel(g: Game, k: string, root: THREE.Group) {
  const bake = CREATURES[k]?.bake;
  if (bake) {
    // 새 손님 모델은 앞이 +x 를 보도록, 기운 것은 바로 서도록 돌려 놓는다
    const bm = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...bake));
    root.traverse((c) => {
      if (c instanceof THREE.Mesh) c.geometry.applyMatrix4(bm);
    });
  }
  g.models.arrived.set(k, root);
  const list = g.models.waiting.get(k) ?? [];
  g.models.waiting.delete(k);
  for (const cb of list) cb(root);
}

/** 원본 크기 상자 */
export function boxOf(g: Game, k: string): THREE.Box3 {
  const b = g.models.manifest.assets[k].box!;
  return new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));
}

/**
 * 모델 틀: 크기 1 쯤·정면 +x 로 통일된 모델을 원하는 크기(by: h 키, w 너비, x·z 그 축)로 맞추고 가운데를 원점에 둔다.
 * 틀의 값(배율·키·너비)은 원본 상자로 정하고, 모델은 도착하면 끼운다.
 * 돌려 둔(bake) 생물 모델은 돌린 뒤 상자가 달라져 도착할 때 다시 잰다.
 */
export function fit(
  g: Game,
  k: string,
  size: number,
  by: string,
  onArrive?: (o: THREE.Group) => void,
): Hold {
  const box = boxOf(g, k),
    sz = box.getSize(new THREE.Vector3()),
    ct = box.getCenter(new THREE.Vector3());
  const hold = new THREE.Group() as Hold;
  const s =
    size / (by === "w" ? Math.max(sz.x, sz.z) : by === "x" ? sz.x : by === "z" ? sz.z : sz.y);
  hold.scale.setScalar(s);
  hold.userData = {
    k: s,
    hh: (sz.y * s) / 2,
    rw: (Math.max(sz.x, sz.z) * s) / 2,
    uLime: { value: 0 },
    yq: new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * 6.28),
  };
  // 모델이 오기 전에도 상자 셈(Box3.setFromObject)이 원본과 같게, 원본 상자를 가진 보이지 않는 대역을 둔다
  const proxy = new THREE.Mesh(new THREE.BufferGeometry());
  proxy.geometry.boundingBox = box.clone();
  proxy.position.copy(ct).negate();
  proxy.visible = false;
  hold.add(proxy);
  whenModel(g, k, (root) => {
    hold.remove(proxy);
    const o = root.clone(true);
    o.traverse((c) => {
      if (c instanceof THREE.Mesh) c.material = (c.material as THREE.MeshStandardMaterial).clone();
    });
    const center = ct.clone();
    if (CREATURES[k]?.bake) {
      const b2 = new THREE.Box3().setFromObject(o),
        sz2 = b2.getSize(new THREE.Vector3());
      b2.getCenter(center);
      const s2 =
        size /
        (by === "w" ? Math.max(sz2.x, sz2.z) : by === "x" ? sz2.x : by === "z" ? sz2.z : sz2.y);
      hold.scale.setScalar(s2);
      Object.assign(hold.userData, {
        k: s2,
        hh: (sz2.y * s2) / 2,
        rw: (Math.max(sz2.x, sz2.z) * s2) / 2,
      });
    }
    o.position.sub(center);
    hold.add(o);
    o.traverse((c) => {
      if (c instanceof THREE.Mesh) applyLook(g, c.material, hold.userData.uLime, k);
    });
    onArrive?.(o);
  });
  return hold;
}

/** 모델이 오면 도형(prims)을 숨긴다 */
export function swapWhenReady(g: Game, k: string, prims: THREE.Object3D[]) {
  whenModel(g, k, () => {
    for (const o of prims) o.visible = false;
  });
}

/** 모델 하나를 n 번까지 찍는 묶음. 키 1·바닥이 원점이 되게 맞춘다. 모델이 manifest 에 없으면 null */
export function inst(g: Game, k: string, n: number): Instancer | null {
  if (!hasModel(g, k)) return null;
  const box = boxOf(g, k),
    sz = box.getSize(new THREE.Vector3()),
    c = box.getCenter(new THREE.Vector3());
  const norm = new THREE.Matrix4()
    .makeScale(1 / sz.y, 1 / sz.y, 1 / sz.y)
    .multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
  const p = g.pl.p;
  const I: Instancer = {
    key: k,
    ims: [],
    n: 0,
    items: [],
    rw: Math.max(sz.x, sz.z) / sz.y / 2,
    count: 0,
    noCull: false,
    add(m) {
      this.items.push({
        M: m.clone(),
        slot: this.n,
        v: new THREE.Vector3().setFromMatrixPosition(m).normalize(),
      });
      for (const im of this.ims) {
        im.setMatrixAt(this.n, m);
        im.count = this.n + 1;
        im.instanceMatrix.needsUpdate = true;
      }
      this.count = this.n + 1;
      return this.n++;
    },
    set(i, m) {
      const it = this.items[i];
      it.M.copy(m);
      if (this.noCull) it.v.setFromMatrixPosition(m).normalize();
      if (it.slot >= 0)
        for (const im of this.ims) {
          im.setMatrixAt(it.slot, m);
          im.instanceMatrix.needsUpdate = true;
        }
    },
    cull(cosCut) {
      if (this.noCull) return;
      let cnt = 0;
      for (const it of this.items) {
        if (it.v.dot(p) > cosCut) {
          for (const im of this.ims) im.setMatrixAt(cnt, it.M);
          it.slot = cnt++;
        } else it.slot = -1;
      }
      for (const im of this.ims) {
        im.count = cnt;
        im.instanceMatrix.needsUpdate = true;
      }
      this.count = cnt;
    },
  };
  whenModel(g, k, (root) => {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const geo: THREE.BufferGeometry = o.geometry
          .clone()
          .applyMatrix4(new THREE.Matrix4().multiplyMatrices(norm, o.matrixWorld)),
        mat = (o.material as THREE.MeshStandardMaterial).clone();
      applyLook(g, mat, { value: 0 }, k);
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.frustumCulled = false;
      for (const it of I.items) if (it.slot >= 0) im.setMatrixAt(it.slot, it.M);
      im.count = I.count;
      g.scene.add(im);
      I.ims.push(im);
    });
  });
  g.models.insts.push(I);
  return I;
}

/** 위쪽(높은 부분)이 어느 쪽에 있는지 — 대포는 주둥이 쪽, 미끄럼틀은 탑 쪽. frame 은 셈을 할 좌표계(세계 행렬 앞에 곱한다) */
export function topDir(
  hold: THREE.Object3D,
  frame: THREE.Matrix4 = new THREE.Matrix4(),
): { x: number; z: number; len: number; ext: number } {
  hold.updateMatrixWorld(true);
  const box = new THREE.Box3(),
    part = new THREE.Box3(),
    m = new THREE.Matrix4();
  hold.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const geometry: THREE.BufferGeometry = o.geometry;
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    m.multiplyMatrices(frame, o.matrixWorld);
    part.copy(geometry.boundingBox!).applyMatrix4(m);
    box.union(part);
  });
  const c = box.getCenter(new THREE.Vector3()),
    cut = box.min.y + (box.max.y - box.min.y) * 0.72,
    acc = new THREE.Vector3(),
    t = new THREE.Vector3();
  let n = 0;
  hold.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    m.multiplyMatrices(frame, o.matrixWorld);
    const a = o.geometry.attributes.position;
    for (let i = 0; i < a.count; i += 3) {
      t.fromBufferAttribute(a, i).applyMatrix4(m);
      if (t.y > cut) {
        acc.add(t);
        n++;
      }
    }
  });
  acc.multiplyScalar(1 / Math.max(1, n)).sub(c);
  acc.y = 0;
  const ext = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  return { x: acc.x, z: acc.z, len: acc.length(), ext };
}

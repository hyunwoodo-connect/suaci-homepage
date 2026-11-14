import * as THREE from "three";

import type { LookUniforms } from "../look";
import { extentBy } from "./extent";
import { styleModel } from "./shader";

// 같은 모델 여럿을 한 번에 그리는 묶음: 생물·별·범퍼·풍선처럼 저마다 움직이고, 몸 휘기(aAn)·라임(aLime)이 다른 것.
// 매 프레임 그릴 것만 begin → push … → end 로 채운다(멀리 있는 것은 넣지 않으면 그리지 않는다).
// 그리기 직전에 flush 가 화면(시야) 밖의 것을 빼고 앞으로 당긴다 — 묶음은 내 둘레 사방에 퍼져 있어서
// 한 번에 그리면 등 뒤의 것까지 정점을 다 셈한다.
// 틀(fit)과 같은 맞춤: 원하는 크기(by)로 맞추고 가운데를 원점에 둔다. 돌려 둔 모델은 도착할 때 다시 잰다

const m4 = new THREE.Matrix4(),
  sc = new THREE.Vector3(),
  ZERO_AN = new THREE.Vector4(),
  sphere = new THREE.Sphere();

/** 몸 휘기(날갯짓·걸음)로 상자 밖으로 나오는 만큼 둘레 공을 넉넉히 */
const BEND_MARGIN = 1.3;

/** 같은 모델 여럿을 한 번에 그리는 묶음 */
export class ModelBatch {
  /** 크기 1 에 대한 배율 */
  k: number;
  /** 키의 절반 */
  hh: number;
  /** 너비의 절반 */
  rw: number;
  /** 모델이 와서 그릴 수 있다 */
  ready = false;
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly an: THREE.InstancedBufferAttribute[] = [];
  private readonly lime: THREE.InstancedBufferAttribute[] = [];
  private n = 0;
  private readonly box: THREE.Box3;
  /** 칸마다 둘레 공(가운데 xyz·반지름) — 시야 밖이면 빼는 데 쓴다 */
  private readonly sph: Float32Array;
  /** 모델(크기 1) 상자의 반대각선 */
  private halfDiag = 1;
  /** 몸 휘는 방식(셰이더 값, 묶음이 같이 쓴다) */
  readonly motion = {
    uAn: { value: new THREE.Vector4() },
    uAk: { value: 0 },
    uAx: { value: 0 },
  };

  constructor(
    readonly key: string,
    readonly capacity: number,
    box: THREE.Box3,
    private readonly size: number,
    private readonly by: string,
    private readonly remeasure: boolean,
  ) {
    this.box = box;
    const sphFloats = capacity * 4;
    this.sph = new Float32Array(sphFloats);
    const sz = new THREE.Vector3();
    box.getSize(sz);
    const extent = extentBy(sz, by);
    this.k = size / extent;
    this.hh = (sz.y * this.k) / 2;
    this.rw = (Math.max(sz.x, sz.z) * this.k) / 2;
  }

  /** 모델이 오면 메시마다 인스턴스 묶음을 만든다(재질은 키마다 하나, 묶음용 셰이더 갈래) */
  build(root: THREE.Group, scene: THREE.Scene, lookU: LookUniforms, motionKind: number) {
    root.updateMatrixWorld(true);
    // 크기·가운데는 원본 상자로(틀과 같다). 돌려 둔 모델만 받은 모양으로 다시 잰다
    const box = this.remeasure ? new THREE.Box3().setFromObject(root) : this.box,
      center = new THREE.Vector3(),
      sz = new THREE.Vector3();
    box.getCenter(center);
    if (this.remeasure) {
      box.getSize(sz);
      const extent = extentBy(sz, this.by);
      this.k = this.size / extent;
      this.hh = (sz.y * this.k) / 2;
      this.rw = (Math.max(sz.x, sz.z) * this.k) / 2;
    }
    box.getSize(sz);
    this.halfDiag = (sz.length() / 2) * BEND_MARGIN;
    this.motion.uAk.value = motionKind;
    const toCenter = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z);
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const place = new THREE.Matrix4().multiplyMatrices(toCenter, o.matrixWorld);
      const geo: THREE.BufferGeometry = o.geometry.clone().applyMatrix4(place);
      const anCount = this.capacity * 4;
      const anFloats = new Float32Array(anCount),
        limeFloats = new Float32Array(this.capacity);
      const anAttr = new THREE.InstancedBufferAttribute(anFloats, 4),
        limeAttr = new THREE.InstancedBufferAttribute(limeFloats, 1);
      anAttr.setUsage(THREE.DynamicDrawUsage);
      limeAttr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute("aAn", anAttr);
      geo.setAttribute("aLime", limeAttr);
      const mat = (o.material as THREE.MeshStandardMaterial).clone();
      const noLime = { value: 0 };
      styleModel(mat, { key: this.key, lookU, lime: noLime, motion: this.motion, batch: true });
      const im = new THREE.InstancedMesh(geo, mat, this.capacity);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      im.count = 0;
      scene.add(im);
      this.meshes.push(im);
      this.an.push(anAttr);
      this.lime.push(limeAttr);
    });
    this.ready = true;
  }

  /** 이번 프레임에 그릴 것을 처음부터 채운다 */
  begin() {
    this.n = 0;
  }

  /** 하나 그린다: 자리·돌림·배율(절대값), 몸 휘기 값, 라임 */
  push(
    pos: THREE.Vector3,
    quat: THREE.Quaternion,
    scale: number,
    an: THREE.Vector4 = ZERO_AN,
    lime = 0,
  ) {
    if (!this.ready || this.n >= this.capacity) return;
    sc.setScalar(scale);
    m4.compose(pos, quat, sc);
    const i = this.n++;
    const at = i * 4;
    this.sph[at] = pos.x;
    this.sph[at + 1] = pos.y;
    this.sph[at + 2] = pos.z;
    this.sph[at + 3] = scale * this.halfDiag;
    for (let j = 0; j < this.meshes.length; j++) {
      this.meshes[j].setMatrixAt(i, m4);
      this.an[j].setXYZW(i, an.x, an.y, an.z, an.w);
      this.lime[j].setX(i, lime);
    }
  }

  /** 이번 프레임 채우기를 마쳤다(그리는 수는 flush 가 시야를 보고 정한다) */
  end() {}

  /** 그리기 직전: 시야 밖의 칸을 빼고 앞으로 당겨, 채운 칸만 올려 보낸다 */
  flush(frustum: THREE.Frustum) {
    if (!this.ready) return;
    const sph = this.sph;
    let kept = 0;
    for (let i = 0; i < this.n; i++) {
      const at = i * 4;
      sphere.center.fromArray(sph, at);
      sphere.radius = sph[at + 3];
      if (!frustum.intersectsSphere(sphere)) continue;
      if (kept !== i) for (let j = 0; j < this.meshes.length; j++) this.moveSlot(j, i, kept);
      kept++;
    }
    for (let j = 0; j < this.meshes.length; j++) {
      const im = this.meshes[j];
      im.count = kept;
      uploadFirst(im.instanceMatrix, kept);
      uploadFirst(this.an[j], kept);
      uploadFirst(this.lime[j], kept);
    }
  }

  // 칸 from 의 행렬·몸 휘기·라임을 칸 to 로
  private moveSlot(j: number, from: number, to: number) {
    const mat = this.meshes[j].instanceMatrix.array,
      an = this.an[j].array,
      lime = this.lime[j].array;
    const mTo = to * 16,
      mFrom = from * 16,
      mEnd = mFrom + 16,
      aTo = to * 4,
      aFrom = from * 4,
      aEnd = aFrom + 4;
    mat.copyWithin(mTo, mFrom, mEnd);
    an.copyWithin(aTo, aFrom, aEnd);
    lime[to] = lime[from];
  }

  /** 치운다 */
  dispose() {
    for (const im of this.meshes) {
      im.removeFromParent();
      im.geometry.dispose();
      (im.material as THREE.Material).dispose();
      im.dispose();
    }
  }
}

/* ─── 내부 ─────────────────────────── */

// 앞의 n 칸만 올려 보낸다(묶음 전체를 매 프레임 보내지 않게)
function uploadFirst(attr: THREE.BufferAttribute, n: number) {
  attr.clearUpdateRanges();
  if (n === 0) return;
  const floats = n * attr.itemSize;
  attr.addUpdateRange(0, floats);
  attr.needsUpdate = true;
}

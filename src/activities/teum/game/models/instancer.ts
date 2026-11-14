import * as THREE from "three";

import { S } from "../settings";
import { UP } from "../world/sphere";

// 같은 모델을 여러 번 찍어 두는 묶음(조형물·나무·풍선 꽃·봉오리). 한 번 찍으면 그 자리에 있고,
// 바뀐 것(눌린 나무·터진 봉오리)만 다시 찍는다. 가까운 것만 칸에 채워 그린다

/** 찍어 둔 것 하나 */
interface Item {
  M: THREE.Matrix4;
  /** 그리는 칸(-1 이면 지금 안 그림) */
  slot: number;
  v: THREE.Vector3;
}

const mI = new THREE.Matrix4(),
  qI = new THREE.Quaternion(),
  qY = new THREE.Quaternion(),
  eY = new THREE.Euler(0, 0, 0, "YXZ"),
  pI = new THREE.Vector3(),
  sI = new THREE.Vector3();

/** 모델 하나를 n 번까지 찍는 묶음. 키 1·바닥이 원점이 되게 맞춘다 */
export class Instancer {
  /** 모델의 메시마다 하나(모델이 오면 생긴다) */
  readonly ims: THREE.InstancedMesh[] = [];
  private readonly items: Item[] = [];
  /** 키 1 일 때 너비의 절반 */
  readonly rw: number;
  /** 지금 그리는 수 */
  private count = 0;
  /** 늘 따라다니는 것(꼬마 라임)은 가까운 것만 그리기에서 뺀다 */
  noCull = false;
  private readonly norm: THREE.Matrix4;

  constructor(
    readonly key: string,
    readonly capacity: number,
    box: THREE.Box3,
  ) {
    const sz = new THREE.Vector3(),
      c = new THREE.Vector3();
    box.getSize(sz);
    box.getCenter(c);
    this.rw = Math.max(sz.x, sz.z) / sz.y / 2;
    const unit = 1 / sz.y,
      bottomToOrigin = new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z);
    this.norm = new THREE.Matrix4().makeScale(unit, unit, unit).multiply(bottomToOrigin);
  }

  /** 찍은 수 */
  get n(): number {
    return this.items.length;
  }

  /** 모델이 오면 메시마다 묶음을 만든다(이미 찍어 둔 칸을 그대로 채운다) */
  build(root: THREE.Group, scene: THREE.Scene) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const toUnit = new THREE.Matrix4().multiplyMatrices(this.norm, o.matrixWorld),
        geo: THREE.BufferGeometry = o.geometry.clone().applyMatrix4(toUnit);
      const im = new THREE.InstancedMesh(geo, o.material, this.capacity);
      im.frustumCulled = false;
      for (const it of this.items) if (it.slot >= 0) im.setMatrixAt(it.slot, it.M);
      im.count = this.count;
      scene.add(im);
      this.ims.push(im);
    });
  }

  /** 하나 찍는다(행렬 그대로). 번호를 돌려준다 */
  add(m: THREE.Matrix4): number {
    const slot = this.items.length;
    const v = new THREE.Vector3().setFromMatrixPosition(m).normalize();
    const item: Item = { M: m.clone(), slot, v };
    this.items.push(item);
    for (const im of this.ims) {
      im.setMatrixAt(slot, m);
      im.count = slot + 1;
      im.instanceMatrix.needsUpdate = true;
    }
    this.count = slot + 1;
    return slot;
  }

  /** i 번째를 다시 찍는다 */
  set(i: number, m: THREE.Matrix4) {
    const it = this.items[i];
    it.M.copy(m);
    if (this.noCull) it.v.setFromMatrixPosition(m).normalize();
    if (it.slot < 0) return;
    for (const im of this.ims) {
      im.setMatrixAt(it.slot, m);
      im.instanceMatrix.needsUpdate = true;
    }
  }

  /** 땅(v)에 세우고 돌리고(yaw) 살짝 기울여(tilt) 하나 찍는다. 번호 */
  stamp(v: THREE.Vector3, base: number, size: number, yaw: number, tilt?: number): number {
    qI.setFromUnitVectors(UP, v);
    const lean = tilt || 0;
    eY.set(lean, yaw, 0, "YXZ");
    qY.setFromEuler(eY);
    qI.multiply(qY);
    const radius = S.R + base;
    pI.copy(v).multiplyScalar(radius);
    sI.setScalar(size);
    mI.compose(pI, qI, sI);
    return this.add(mI);
  }

  /** i 번째를 다시 찍는다(눌려서 납작해질 때 sy) */
  restamp(i: number, v: THREE.Vector3, base: number, size: number, yaw: number, sy: number) {
    qI.setFromUnitVectors(UP, v);
    qY.setFromAxisAngle(UP, yaw);
    qI.multiply(qY);
    const radius = S.R + base;
    pI.copy(v).multiplyScalar(radius);
    const height = size * sy;
    sI.set(size, height, size);
    mI.compose(pI, qI, sI);
    this.set(i, mI);
  }

  /** i 번째를 그 높이(hAbs)로 옮긴다 */
  put(i: number, v: THREE.Vector3, hAbs: number, size: number, yaw: number, sy?: number) {
    qI.setFromUnitVectors(UP, v);
    qY.setFromAxisAngle(UP, yaw);
    qI.multiply(qY);
    const radius = S.R + hAbs;
    pI.copy(v).multiplyScalar(radius);
    const stretch = sy || 1;
    const height = size * stretch;
    sI.set(size, height, size);
    mI.compose(pI, qI, sI);
    this.set(i, mI);
  }

  /** 가까운 것(v·p > cosCut)만 칸에 채운다 */
  cull(p: THREE.Vector3, cosCut: number) {
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
  }

  /** 치운다(장면에서 빼고 지오메트리를 버린다 — 재질은 모델 것이라 두고 간다) */
  dispose() {
    for (const im of this.ims) {
      im.removeFromParent();
      im.geometry.dispose();
      im.dispose();
    }
  }
}

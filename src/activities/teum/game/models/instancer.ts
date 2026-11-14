import * as THREE from "three";

import { S } from "../settings";
import { UP } from "../world/sphere";

// 같은 모델을 여러 번 찍어 두는 묶음(조형물·나무·풍선 꽃·봉오리). 한 번 찍으면 그 자리에 있고,
// 바뀐 것(눌린 나무·터진 봉오리)만 다시 찍는다. 가까운 것은 가까운 것만 그리기 때마다(cull) 고르고,
// 그중 시야 안의 것만 매 프레임 그리기 직전(flush)에 칸에 채운다

/** 찍어 둔 것 하나: 행렬, 행성 위 자리, 둘레 공(시야 검사) */
interface Item {
  M: THREE.Matrix4;
  v: THREE.Vector3;
  sphere: THREE.Sphere;
}

const mI = new THREE.Matrix4(),
  qI = new THREE.Quaternion(),
  qY = new THREE.Quaternion(),
  eY = new THREE.Euler(0, 0, 0, "YXZ"),
  pI = new THREE.Vector3(),
  sI = new THREE.Vector3(),
  HALF_UP = new THREE.Vector3(0, 0.5, 0);

/** 모델 하나를 n 번까지 찍는 묶음. 키 1·바닥이 원점이 되게 맞춘다 */
export class Instancer {
  /** 모델의 메시마다 하나(모델이 오면 생긴다) */
  readonly ims: THREE.InstancedMesh[] = [];
  private readonly items: Item[] = [];
  /** 가까운 것(마지막 cull 때 고른 번호) */
  private near: number[] = [];
  private everCulled = false;
  /** 키 1 일 때 너비의 절반 */
  readonly rw: number;
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

  /**
   * 모델이 오면 메시마다 묶음을 만든다(이미 찍어 둔 칸을 그대로 채운다). 재질은 materialFor 가 준 것 —
   * 낱개 틀과 같은 재질을 쓰면 three 가 그릴 때마다 셰이더를 다시 골라(인스턴싱이 켜졌다 꺼졌다) 가비지가 생긴다
   */
  build(root: THREE.Group, scene: THREE.Scene, materialFor: (m: THREE.Material) => THREE.Material) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const toUnit = new THREE.Matrix4().multiplyMatrices(this.norm, o.matrixWorld),
        geo: THREE.BufferGeometry = o.geometry.clone().applyMatrix4(toUnit);
      const mat = materialFor(o.material as THREE.Material);
      const im = new THREE.InstancedMesh(geo, mat, this.capacity);
      im.frustumCulled = false;
      im.count = 0;
      scene.add(im);
      this.ims.push(im);
    });
  }

  /** 찍은 것들의 행성 위 자리 */
  spots(): THREE.Vector3[] {
    return this.items.map((it) => it.v);
  }

  /** 하나 찍는다(행렬 그대로). 번호를 돌려준다 */
  add(m: THREE.Matrix4): number {
    const i = this.items.length;
    const v = new THREE.Vector3().setFromMatrixPosition(m).normalize();
    const item: Item = { M: m.clone(), v, sphere: new THREE.Sphere() };
    boundOf(item, this.rw);
    this.items.push(item);
    // 처음 가까운 것 고르기 전에는 모두 가까운 것으로 본다(시제품도 찍자마자 그렸다)
    if (!this.everCulled) this.near.push(i);
    return i;
  }

  /** i 번째를 다시 찍는다 */
  set(i: number, m: THREE.Matrix4) {
    const it = this.items[i];
    it.M.copy(m);
    if (this.noCull) it.v.setFromMatrixPosition(m).normalize();
    boundOf(it, this.rw);
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

  /** 가까운 것(v·p > cosCut)을 고른다(그리기는 flush 가) */
  cull(p: THREE.Vector3, cosCut: number) {
    if (this.noCull) return;
    this.everCulled = true;
    const near = this.near;
    near.length = 0;
    for (let i = 0; i < this.items.length; i++) if (this.items[i].v.dot(p) > cosCut) near.push(i);
  }

  /** 그리기 직전: 가까운 것 가운데 시야 안의 것만 칸에 채운다 */
  flush(frustum: THREE.Frustum) {
    if (!this.ims.length) return;
    let cnt = 0;
    for (const i of this.near) {
      const it = this.items[i];
      if (!frustum.intersectsSphere(it.sphere)) continue;
      for (const im of this.ims) im.setMatrixAt(cnt, it.M);
      cnt++;
    }
    const floats = cnt * 16;
    for (const im of this.ims) {
      im.count = cnt;
      const attr = im.instanceMatrix;
      attr.clearUpdateRanges();
      if (!cnt) continue;
      attr.addUpdateRange(0, floats);
      attr.needsUpdate = true;
    }
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

/* ─── 내부 ─────────────────────────── */

// 둘레 공: 바닥이 원점·키 1·너비 2rw 인 모델이라 가운데는 키의 절반 위, 반지름은 그 상자의 반대각선
function boundOf(it: Item, rw: number) {
  const m = it.M;
  it.sphere.center.copy(HALF_UP).applyMatrix4(m);
  const scale = m.getMaxScaleOnAxis();
  const halfDiagSq = 0.25 + 2 * rw * rw;
  it.sphere.radius = scale * Math.sqrt(halfDiagSq);
}

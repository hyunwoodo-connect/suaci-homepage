import * as THREE from "three";

import type { Instancer } from "../models";
import type { Game } from "../state";
import { S } from "../state";
import { offset, UP } from "../world/sphere";

// 풍경을 놓을 때 쓰는 자리 도구: 이미 찬 자리(occ), 비행 통로(COR), 마을 중심(HV), 찍어 두기(stamp)

/** 둥근 자리 하나 */
export interface Zone {
  v: THREE.Vector3;
  r: number;
}

const mI = new THREE.Matrix4(),
  qI = new THREE.Quaternion(),
  qY = new THREE.Quaternion(),
  pI = new THREE.Vector3(),
  sI = new THREE.Vector3();

/** 찬 자리에 더한다 */
export function occAdd(g: Game, v: THREE.Vector3, r: number) {
  g.scenery.occ.push({ v, r });
}

/** v 둘레 r 이 비어 있나 */
export function freeAt(g: Game, v: THREE.Vector3, r: number): boolean {
  return !g.scenery.occ.some((o) => o.v.angleTo(v) * S.R < o.r + r);
}

/** 비행 통로에 더한다(놀이기구가 나를 실어 보내는 길) */
export function corAdd(g: Game, v: THREE.Vector3, r: number) {
  g.scenery.COR.push({ v, r });
}

/** 비행 통로 가까이인가 */
export function corNear(g: Game, v: THREE.Vector3, pad: number): boolean {
  return g.scenery.COR.some((c) => c.v.angleTo(v) * S.R < c.r + pad);
}

/** v 에서 d 방향으로 거리 m 만큼(곧게) */
export function along(v: THREE.Vector3, d: THREE.Vector3, m: number): THREE.Vector3 {
  return v
    .clone()
    .addScaledVector(d, Math.tan(m / S.R))
    .normalize();
}

/** 마을 hk 중심에서 거리(넓이 배)·방향의 자리 */
export function hubAt(g: Game, hk: number, d: number, b: number): THREE.Vector3 {
  return offset(g.scenery.HV[hk], d * S.wide, b);
}

/** 묶음에 하나 찍는다: 땅에 세우고 돌리고(yaw) 살짝 기울인다(tilt). 찍은 번호 */
export function stamp(
  I: Instancer,
  v: THREE.Vector3,
  base: number,
  size: number,
  yaw: number,
  tilt?: number,
): number {
  qI.setFromUnitVectors(UP, v);
  qY.setFromEuler(new THREE.Euler(tilt || 0, yaw, 0, "YXZ"));
  qI.multiply(qY);
  pI.copy(v).multiplyScalar(S.R + base);
  sI.setScalar(size);
  mI.compose(pI, qI, sI);
  return I.add(mI);
}

/** 찍어 둔 것을 다시 찍는다(눌려서 납작해질 때 sy) */
export function restamp(
  I: Instancer,
  i: number,
  v: THREE.Vector3,
  base: number,
  size: number,
  yaw: number,
  sy: number,
) {
  qI.setFromUnitVectors(UP, v);
  qY.setFromAxisAngle(UP, yaw);
  qI.multiply(qY);
  pI.copy(v).multiplyScalar(S.R + base);
  sI.set(size, size * sy, size);
  mI.compose(pI, qI, sI);
  I.set(i, mI);
}

/** 찍어 둔 것을 그 높이(hAbs)로 옮긴다 */
export function putI(
  I: Instancer,
  i: number,
  v: THREE.Vector3,
  hAbs: number,
  size: number,
  yaw: number,
  sy?: number,
) {
  qI.setFromUnitVectors(UP, v);
  qY.setFromAxisAngle(UP, yaw);
  qI.multiply(qY);
  pI.copy(v).multiplyScalar(S.R + hAbs);
  sI.set(size, size * (sy || 1), size);
  mI.compose(pI, qI, sI);
  I.set(i, mI);
}

import * as THREE from "three";

import { S } from "../state";

// 구 모양 세계의 자리 계산. 자리는 행성 중심에서 본 단위 벡터, 높이는 따로(air·lift) 둔다

/** 위(+y) */
export const UP = new THREE.Vector3(0, 1, 0);
/** 앞(+z) */
export const FWD = new THREE.Vector3(0, 0, 1);
/** 출발점(광장) — 행성 꼭대기 */
export const START = new THREE.Vector3(0, 1, 0);

/** 도 → 라디안 */
export const rad = THREE.MathUtils.degToRad;
/** 범위로 자른다 */
export const clamp = THREE.MathUtils.clamp;

/** v 에서 방향 0 도가 되는 접선 */
export function refT(v: THREE.Vector3): THREE.Vector3 {
  // 극 근처에서는 위(+y)와 거의 나란해 외적이 0 이 되므로 x 축을 기준으로 삼는다
  const isNearPole = Math.abs(v.y) > 0.9;
  const ref = isNearPole ? new THREE.Vector3(1, 0, 0) : UP;
  return new THREE.Vector3().crossVectors(v, ref).normalize();
}

/** v 에서 bearing 방향으로 dist 만큼 간 자리 */
export function offset(v: THREE.Vector3, dist: number, bearing: number): THREE.Vector3 {
  const bearingRad = rad(bearing);
  const t = refT(v).applyAxisAngle(v, bearingRad);
  const arc = dist / S.R;
  return v.clone().applyAxisAngle(t, arc).normalize();
}

/** 출발점에서 거리·방향으로 정한 자리. 놀이와 장소 사이를 넓이(S.wide)만큼 벌린다 */
export function from(dist: number, bearing: number): THREE.Vector3 {
  const wideDist = dist * S.wide;
  return offset(START, wideDist, bearing);
}

/** v 에서의 방향(도): 0 = 광장에서 멀어지는 쪽, 90 = 시계 방향, 180 = 광장 쪽 */
export function heading(v: THREE.Vector3, deg: number): THREE.Vector3 {
  const startAlong = START.dot(v);
  const o = v.clone().multiplyScalar(startAlong).sub(START);
  // 광장 바로 위에서는 '멀어지는 쪽'이 없으므로 기준 접선을 쓴다
  const away = o.lengthSq() < 1e-8 ? refT(v) : o.normalize();
  const degRad = rad(deg);
  const t = away.applyAxisAngle(v, degRad);
  const tAlong = t.dot(v);
  return t.addScaledVector(v, -tAlong).normalize();
}

/** v 에서 d 방향으로 dist 만큼, curve 도 만큼 휘며 간다. [새 자리, 새 방향] */
export function step(
  v: THREE.Vector3,
  d: THREE.Vector3,
  dist: number,
  curve?: number,
): [THREE.Vector3, THREE.Vector3] {
  const ax = new THREE.Vector3().crossVectors(v, d).normalize(),
    a = dist / S.R;
  const nv = v.clone().applyAxisAngle(ax, a).normalize(),
    nd = d.clone().applyAxisAngle(ax, a);
  const curveDeg = curve || 0;
  const curveRad = rad(curveDeg);
  nd.applyAxisAngle(nv, curveRad);
  const ndAlong = nd.dot(nv);
  nd.addScaledVector(nv, -ndAlong).normalize();
  return [nv, nd];
}

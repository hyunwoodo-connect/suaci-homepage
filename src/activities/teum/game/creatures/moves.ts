import * as THREE from "three";

import { S } from "../settings";
import type { Creature } from "./creature";

// 생물이 움직이는 기본 동작: 바라보기·걷기·달아나기. 새 벡터를 만들지 않는다

const cv = new THREE.Vector3();

/** 그쪽(tv)을 본다(k 만큼 돌린다) */
export function face(c: Creature, tv: THREE.Vector3, k?: number) {
  const upPart = tv.dot(c.v);
  cv.copy(tv).addScaledVector(c.v, -upPart);
  if (cv.lengthSq() < 1e-10) return;
  cv.normalize();
  const blend = k === undefined ? 0.15 : k;
  c.f.lerp(cv, blend).normalize();
}

/** 걸어서 간다: 몸을 먼저 돌리고, 보는 쪽으로 나아간다. 걸음 수는 간 거리만큼. 남은 거리를 돌려준다 */
export function go(c: Creature, tv: THREE.Vector3, spd: number, dt: number, stride?: number) {
  const d = c.v.angleTo(tv) * S.R;
  if (d < 0.05) return d;
  const decay = -5 * dt;
  const turn = 1 - Math.exp(decay);
  face(c, tv, turn);
  const reach = spd * dt;
  const st = Math.min(d, reach);
  const arc = st / S.R;
  const stepLen = Math.tan(arc);
  c.v.addScaledVector(c.f, stepLen).normalize();
  const fUp = c.f.dot(c.v);
  c.f.addScaledVector(c.v, -fUp).normalize();
  c.ph += st * (stride || 4.6);
  return d;
}

/** p 에게서 멀어진다 */
export function away(
  c: Creature,
  p: Readonly<THREE.Vector3>,
  spd: number,
  dt: number,
  stride?: number,
) {
  cv.copy(c.v).sub(p);
  const cvUp = cv.dot(c.v);
  cv.addScaledVector(c.v, -cvUp);
  if (cv.lengthSq() < 1e-10) cv.copy(c.f);
  cv.normalize();
  const decay = -7 * dt;
  const turn = 1 - Math.exp(decay);
  c.f.lerp(cv, turn).normalize();
  const arc = (spd * dt) / S.R;
  const stepLen = Math.tan(arc);
  c.v.addScaledVector(c.f, stepLen).normalize();
  const fUp = c.f.dot(c.v);
  c.f.addScaledVector(c.v, -fUp).normalize();
  c.ph += spd * dt * (stride || 2.6);
}

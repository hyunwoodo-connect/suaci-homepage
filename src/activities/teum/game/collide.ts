import * as THREE from "three";

import type { Game } from "./state";
import { S } from "./state";

const sn = new THREE.Vector3();

/**
 * 속으로는 못 들어간다: v 둘레 core 안(높이 top 아래)에 있으면 둘레로 밀어내고,
 * 들어오던 속도는 옆으로 흘린다. 밀어냈으면 true.
 */
export function blockAt(g: Game, v: THREE.Vector3, core: number, top: number): boolean {
  const pl = g.pl,
    p = pl.p,
    vel = pl.vel;
  if (pl.air >= top || p.angleTo(v) * S.R >= core) return false;
  sn.copy(p).sub(v);
  sn.addScaledVector(v, -sn.dot(v));
  if (sn.lengthSq() < 1e-12) sn.copy(vel).negate();
  sn.normalize();
  p.copy(v)
    .addScaledVector(sn, core / S.R)
    .normalize();
  sn.addScaledVector(p, -sn.dot(p)).normalize();
  const vn = vel.dot(sn);
  if (vn < 0) {
    vel.addScaledVector(sn, -1.5 * vn);
    vel.addScaledVector(p, -vel.dot(p)).normalize();
    pl.spd *= 0.8;
  }
  return true;
}

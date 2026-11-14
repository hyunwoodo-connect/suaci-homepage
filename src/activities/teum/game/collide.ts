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
  // 밀어낼 방향: v 에서 나를 향하는 접선(딱 겹치면 오던 길 반대로)
  sn.copy(p).sub(v);
  const snAlongV = sn.dot(v);
  sn.addScaledVector(v, -snAlongV);
  if (sn.lengthSq() < 1e-12) sn.copy(vel).negate();
  sn.normalize();
  const coreAngle = core / S.R;
  p.copy(v).addScaledVector(sn, coreAngle).normalize();
  const snAlongP = sn.dot(p);
  sn.addScaledVector(p, -snAlongP).normalize();
  const vn = vel.dot(sn);
  if (vn < 0) {
    // 들어오던 성분을 1.5배로 되돌려 살짝 튕겨 나간다
    const bounce = -1.5 * vn;
    vel.addScaledVector(sn, bounce);
    const velRadial = vel.dot(p);
    vel.addScaledVector(p, -velRadial).normalize();
    pl.spd *= 0.8;
  }
  return true;
}

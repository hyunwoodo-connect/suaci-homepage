import * as THREE from "three";

import type { Game } from "./state";
import { S } from "./state";

const sn = new THREE.Vector3(),
  bt = new THREE.Vector3();

/**
 * 속으로는 못 들어간다: v 둘레 core 안(높이 top 아래)에 있으면 둘레로 밀어내고,
 * 들어오던 속도는 옆으로 흘린다. 밀어냈으면 true.
 * 정면으로 부딪혀도 서 버리지 않게 안으로 들어가던 속도만 지우고 둘레를 따라 미끄러진다(전에는 부딪힐 때마다
 * 20%씩 느려져 닿아 있는 동안 금세 멈춰 섰다). 정면이라 옆 방향이 없으면 한쪽을 골라 준다.
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
    vel.addScaledVector(sn, -vn);
    bt.crossVectors(p, sn).normalize();
    const side = vel.dot(bt);
    if (Math.abs(side) < 0.45) {
      // 거의 정면: 옆으로 빠질 쪽이 뚜렷하면 그쪽, 아니면 보고 있는 쪽으로
      let sg: number;
      if (Math.abs(side) > 0.02) sg = Math.sign(side);
      else sg = pl.h.dot(bt) >= 0 ? 1 : -1;
      const nudge = sg * 0.6;
      vel.addScaledVector(bt, nudge);
    }
    const velRadial = vel.dot(p);
    vel.addScaledVector(p, -velRadial).normalize();
    // 닿아 있는 동안만 조금씩 느려진다
    const slow = -1.2 * g.t.dt;
    pl.spd *= Math.exp(slow);
  }
  return true;
}

import * as THREE from "three";

import { say } from "../hud";
import type { Hold } from "../models";
import type { Game } from "../state";
import { GREY_TOY, S } from "../state";
import type { GreyMesh } from "../world/materials";
import { grey } from "../world/materials";
import { from, offset, UP } from "../world/sphere";
import { featGround } from "../world/terrain";

// 범퍼 밭 — 부딪히면 튕겨 나간다(모델은 버섯)

/** 범퍼 하나(밭마다 아홉) */
export interface Bumper {
  m: GreyMesh;
  dist: number;
  bear: number;
  k: number;
  v: THREE.Vector3;
  lit: number;
  cool: number;
  model?: Hold;
}

const tmp = new THREE.Vector3();

/** 범퍼 밭을 만든다 */
export function createBumpers(g: Game): Bumper[] {
  const bumpers: Bumper[] = [];
  for (const { dist, bear } of g.L.bumper)
    for (let k = 0; k < 9; k++) {
      const geo = new THREE.SphereGeometry(1.7, 20, 14);
      const mat = grey(g.mats, GREY_TOY);
      const m = new THREE.Mesh(geo, mat);
      g.scene.add(m);
      const v = new THREE.Vector3();
      bumpers.push({ m, dist, bear, k, v, lit: 0, cool: 0 });
    }
  return bumpers;
}

/** 범퍼 자리: 가운데 하나와 둘레 여덟 */
export function layoutBumpers(g: Game, keep: THREE.Vector3[]) {
  for (const b of g.bumpers) {
    const center = from(b.dist, b.bear);
    const ringDist = 7 + (b.k % 2) * 6.5;
    const ringBear = b.k * 45;
    const spot = b.k === 0 ? center : offset(center, ringDist, ringBear);
    b.v.copy(spot);
    keep.push(b.v);
    const radius = S.R + featGround(g, b.v) + 0.5;
    b.m.position.copy(b.v).multiplyScalar(radius);
  }
}

/** 범퍼: 부딪히면 튕겨 나간다 */
export function bumpersFrame(g: Game) {
  const { pl, t } = g,
    { p, vel } = pl,
    dt = t.dt,
    TC = g.mats.toy,
    lime = g.mats.lime;
  for (const b of g.bumpers) {
    if (b.cool > 0) b.cool -= dt;
    else if (!t.held && pl.air < 3 && p.angleTo(b.v) * S.R < 2.7) {
      tmp.copy(p).sub(b.v);
      const tUp = tmp.dot(p);
      tmp.addScaledVector(p, -tUp);
      if (tmp.lengthSq() < 1e-12) tmp.copy(vel).negate();
      tmp.normalize();
      const vn = vel.dot(tmp);
      const reflect = -2 * vn;
      if (vn < 0) vel.addScaledVector(tmp, reflect).normalize();
      else vel.lerp(tmp, 0.5).normalize();
      pl.boost = Math.max(pl.boost, 1.5);
      pl.stun = 0.45;
      b.lit = 1;
      b.cool = 0.35;
      if (!g.said.bumper) {
        g.said.bumper = true;
        say(g, "범퍼 — 부딪히면 튕겨 나갑니다");
      }
    }
    const dimmed = b.lit - dt * 1.6;
    b.lit = Math.max(0, dimmed);
    const swell = 1 + b.lit * 0.35;
    b.m.scale.setScalar(swell);
    b.m.material.color.copy(TC.bumper).lerp(lime, b.lit);
  }
}

/** 버섯 모델이 범퍼 도형을 따라 움직이고 부딪히면 부푼다 */
export function bumperModelsFrame(g: Game) {
  for (const b of g.bumpers)
    if (b.model) {
      const u = b.model.userData;
      const lift = u.hh - 0.7;
      b.model.position.copy(b.m.position).addScaledVector(b.v, lift);
      b.model.quaternion.setFromUnitVectors(UP, b.v);
      const swell = u.k * (1 + b.lit * 0.3);
      b.model.scale.setScalar(swell);
      u.uLime.value = b.lit * 0.5;
    }
}

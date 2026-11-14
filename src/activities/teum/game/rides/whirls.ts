import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { GREY_TOY, S } from "../state";
import type { LayoutWhirl } from "../world/layout";
import { grey } from "../world/materials";
import { from, step, UP } from "../world/sphere";
import { featGround } from "../world/terrain";

// 회오리 — 닿으면 빙글빙글 빨려 올라갔다가 튕겨 나간다

/** 회오리 하나 */
export interface Whirl extends LayoutWhirl {
  g: THREE.Group;
  spin: THREE.Group;
  v: THREE.Vector3;
  cool: number;
}

/** 회오리에 실려 있는 동안. h0 는 들어올 때의 방향(카메라가 같이 돌지 않게 — 깔때기도 쓴다) */
export interface WhirlRide {
  on: boolean;
  t: number;
  w: Whirl | null;
  h0: THREE.Vector3;
}

const tmp = new THREE.Vector3();

/** 회오리를 만든다 */
export function createWhirls(g: Game): Whirl[] {
  return g.L.whirl.map((w) => {
    const gr = new THREE.Group(),
      spin = new THREE.Group();
    gr.add(spin);
    for (let i = 0; i < 7; i++) {
      const ringRadius = 1.4 + i * 0.85;
      const ringGeo = new THREE.TorusGeometry(ringRadius, 0.3, 10, 36);
      const ringMat = grey(g.mats, GREY_TOY);
      const t = new THREE.Mesh(ringGeo, ringMat);
      t.rotation.x = Math.PI / 2;
      t.position.y = 1.2 + i * 2.5;
      spin.add(t);
    }
    spin.scale.set(1.7, 2.2, 1.7);
    g.scene.add(gr);
    return { ...w, g: gr, spin, v: new THREE.Vector3(), cool: 0 };
  });
}

/** 회오리 자리: 바람길 끝 조금 앞이거나 제 자리 */
export function layoutWhirls(g: Game, keep: THREE.Vector3[]) {
  const STREAMS = g.streams.list;
  for (const w of g.whirls) {
    let spot: THREE.Vector3;
    if (w.afterStream != null) {
      const stream = STREAMS[w.afterStream];
      [spot] = step(stream.endV, stream.endD, 10, 0);
    } else spot = from(w.dist!, w.bear!);
    w.v.copy(spot);
    keep.push(w.v);
    const radius = S.R + featGround(g, w.v);
    w.g.position.copy(w.v).multiplyScalar(radius);
    w.g.quaternion.setFromUnitVectors(UP, w.v);
  }
}

/** 회오리: 닿으면 빨려 들어가 돌며 솟는다 */
export function whirlsFrame(g: Game) {
  const { pl, t } = g,
    { p, h, vel } = pl,
    dt = t.dt,
    whirl = g.rides.whirl;
  for (const w of g.whirls) {
    w.spin.rotation.y += dt * (whirl.on && whirl.w === w ? 7 : 1.6);
    if (w.cool > 0) w.cool -= dt;
    else if (!t.held && pl.air < 12 && p.angleTo(w.v) * S.R < 5) {
      whirl.on = true;
      whirl.t = 0;
      whirl.w = w;
      whirl.h0.copy(h);
      say(g, "회오리 — 빙글빙글 빨려 올라갑니다");
    }
  }
  if (whirl.on) {
    const w = whirl.w!;
    whirl.t += dt;
    if (p.angleTo(w.v) * S.R < 3.2) {
      const pUp = p.dot(w.v);
      tmp.copy(p).addScaledVector(w.v, -pUp);
      if (tmp.lengthSq() < 1e-10) tmp.copy(h);
      tmp.normalize();
      const rimAngle = 3.6 / S.R;
      p.copy(w.v).addScaledVector(tmp, rimAngle).normalize();
    }
    const turn = 2.5 * dt;
    p.applyAxisAngle(w.v, turn).normalize();
    h.crossVectors(w.v, p);
    const hUp = h.dot(p);
    h.addScaledVector(p, -hUp).normalize();
    vel.copy(h);
    pl.vy = 6.2;
    if (pl.air <= 0) pl.air = 0.01;
    if (whirl.t > 3.2) {
      whirl.on = false;
      w.cool = 5;
      pl.boost = 1.6;
      pl.vy = 3.5;
    }
  }
  const spinning = whirl.on || g.rides.funnel.on;
  const spinTarget = spinning ? 1 : 0;
  const blendRate = spinning ? 5 : 1.5;
  const blendDecay = -blendRate * dt;
  const blendPull = 1 - Math.exp(blendDecay);
  pl.wB += (spinTarget - pl.wB) * blendPull;
}

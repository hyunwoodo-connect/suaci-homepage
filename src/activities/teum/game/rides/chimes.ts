import * as THREE from "three";

import { blockAt } from "../collide";
import { burst } from "../fx/sparks";
import { say } from "../hud";
import type { Hold } from "../models";
import type { Game } from "../state";
import { GREY_TOY, S } from "../state";
import type { GreyMesh } from "../world/materials";
import { grey } from "../world/materials";
import { from, UP } from "../world/sphere";
import { featGround } from "../world/terrain";

// 칙 종 — 칙 하면 가까운 것들이 가까운 순서로 울린다. 닿아도 울리고 둘레 꽃이 핀다

/** 종 하나(무리마다 큰 종 하나) */
export interface Chime {
  g: THREE.Group;
  w: THREE.Group;
  ball: GreyMesh;
  dist: number;
  bear: number;
  k: number;
  v: THREE.Vector3;
  ringAt: number;
  lit: number;
  model?: Hold;
}

/** 종을 만든다 */
export function createChimes(g: Game): Chime[] {
  const chimes: Chime[] = [];
  for (const { dist, bear } of g.L.chime)
    for (let k = 0; k < 1; k++) {
      const gr = new THREE.Group(),
        w = new THREE.Group();
      gr.add(w);
      const poleGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8);
      const poleMat = grey(g.mats, 0xa9adac);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 1.2;
      const ballGeo = new THREE.SphereGeometry(0.7, 16, 12);
      const ballMat = grey(g.mats, GREY_TOY);
      const ball = new THREE.Mesh(ballGeo, ballMat);
      ball.position.y = 2.7;
      w.add(pole, ball);
      g.scene.add(gr);
      const v = new THREE.Vector3();
      chimes.push({ g: gr, w, ball, dist, bear, k, v, ringAt: -1, lit: 0 });
    }
  return chimes;
}

/** 종 자리 */
export function layoutChimes(g: Game, keep: THREE.Vector3[]) {
  for (const c of g.chimes) {
    const spot = from(c.dist, c.bear);
    c.v.copy(spot);
    keep.push(c.v);
    const radius = S.R + featGround(g, c.v);
    c.g.position.copy(c.v).multiplyScalar(radius);
    c.g.quaternion.setFromUnitVectors(UP, c.v);
  }
}

/** 칙에 울리는 것들: 종이 차례로 울리고, 기둥·구름·고리도 칙 소리에 반응한다 */
export function chimesFrame(g: Game) {
  const { pl, t, time } = g,
    dt = t.dt,
    TC = g.mats.toy,
    lime = g.mats.lime,
    chimes = g.chimes,
    bumps = g.terrain.bumps;
  for (const c of chimes) {
    if (c.ringAt > 0 && time >= c.ringAt) {
      c.ringAt = -1;
      c.lit = 1;
      if (!g.said.chime) {
        g.said.chime = true;
        say(g, "칙 — 가까운 것들이 차례로 울립니다");
      }
    }
    if (!t.held) blockAt(g, c.v, 2.6, 8);
    if (!t.held && pl.air < 8 && c.lit < 0.2 && c.ringAt < 0 && pl.p.angleTo(c.v) * S.R < 4.6) {
      // 닿으면 울리고 둘레 꽃이 핀다
      const top = c.g.position.clone().addScaledVector(c.v, 5);
      burst(g, top, 10, 8);
      for (let k = 0; k < bumps.v.length; k++)
        if (2 * (1 - c.v.dot(bumps.v[k])) * S.R * S.R < 700) bumps.lit[k] = 1;
      for (const o of chimes)
        if (o.dist === c.dist && o.bear === c.bear && o.lit < 0.2)
          o.ringAt = time + 0.01 + o.v.angleTo(c.v) * S.R * 0.045;
      if (!g.said.chime) {
        g.said.chime = true;
        say(g, "종 — 닿으면 울립니다. 칙 해도 울립니다");
      }
    }
    const dimmed = c.lit - dt * 0.7;
    c.lit = Math.max(0, dimmed);
    const wobblePhase = time * 3 + c.k;
    const swell = 1 + c.lit * 0.8 + 0.04 * Math.sin(wobblePhase);
    c.ball.scale.setScalar(swell);
    const glowRaw = c.lit * 1.5;
    const glow = Math.min(1, glowRaw);
    c.ball.material.color.copy(TC.chime).lerp(lime, glow);
    const swingPhase = c.lit * 16;
    c.w.rotation.z = Math.sin(swingPhase) * 0.4 * c.lit;
  }
  for (const p of g.pillars.list)
    if (p.ringAt > 0 && time >= p.ringAt) {
      p.ringAt = -1;
      p.lit = 1;
    }
  for (const pd of g.pads.list)
    if (pd.ringAt > 0 && time >= pd.ringAt) {
      pd.ringAt = -1;
      pd.sq = 1;
    }
  for (const r of g.rings)
    if (r.ringAt > 0 && time >= r.ringAt) {
      r.ringAt = -1;
      r.lit = 1;
    }
}

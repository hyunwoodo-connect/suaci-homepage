import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { S } from "../state";
import { from } from "../world/sphere";

// 고래 등 — 출발점 둘레를 천천히 돈다. 높이 떠 있을 때 고래가 지나가면 올라탄다(고리 줄이나 통통 구름으로 올라가야 닿는다)

/** 고래 */
export interface Whale {
  /** 자리(그룹)와 모양(도형 또는 에셋)을 나눈다 */
  g: THREE.Group;
  prim: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  v: THREE.Vector3;
  f: THREE.Vector3;
}

/** 고래 등에 타 있는 동안 */
export interface WhaleRide {
  on: boolean;
  t: number;
  cool: number;
}

/** 고래가 떠 있는 높이 */
export const WH = 150;
/** 고래 등에서 내 몸이 떠 있는 높이 */
const RIDE_H = 5.6;

const bx = new THREE.Vector3(),
  m4 = new THREE.Matrix4();

/** 고래를 만든다 */
export function createWhale(g: Game): Whale {
  const gr = new THREE.Group();
  const prim = new THREE.Mesh(
    new THREE.SphereGeometry(1, 28, 18),
    new THREE.MeshBasicMaterial({ color: 0xd7dad9 }),
  );
  prim.scale.set(16, 5, 6.5);
  gr.add(prim);
  g.scene.add(gr);
  return { g: gr, prim, v: new THREE.Vector3(), f: new THREE.Vector3() };
}

/** 고래가 출발점 둘레를 돈다(이번 프레임의 자리) */
export function whaleMove(g: Game) {
  const w = g.whale,
    time = g.time;
  const wdeg = (time * 5.73) / S.wide;
  g.t.wbob = Math.sin(time * 0.6) * 1.2;
  w.v.copy(from(70, wdeg));
  w.f.copy(from(70, wdeg + 1.5)).sub(w.v);
  w.f.addScaledVector(w.v, -w.f.dot(w.v)).normalize();
  w.g.position.copy(w.v).multiplyScalar(S.R + WH + g.t.wbob);
  bx.crossVectors(w.v, w.f).normalize().negate();
  m4.makeBasis(w.f, w.v, bx);
  w.g.quaternion.setFromRotationMatrix(m4);
}

/** 고래 등: 높이 떠서 가까이 가면 올라타고, 끌면 내린다 */
export function whaleFrame(g: Game) {
  const { pl, t } = g,
    { p, h, vel } = pl,
    dt = t.dt,
    ride = g.rides.whale,
    w = g.whale;
  if (ride.cool > 0) ride.cool -= dt;
  if (
    !ride.on &&
    ride.cool <= 0 &&
    !g.rides.whirl.on &&
    pl.air > 3 &&
    p.angleTo(w.v) * S.R < 26 &&
    Math.abs(t.alt - (WH + 6)) < 15
  ) {
    ride.on = true;
    ride.t = 0;
    say(g, "고래 등 — 끌면 내립니다");
  }
  if (ride.on) {
    ride.t += dt;
    const k = 1 - Math.exp(-6 * dt);
    p.lerp(w.v, k).normalize();
    h.lerp(w.f, k);
    h.addScaledVector(p, -h.dot(p)).normalize();
    vel.copy(h);
    pl.vy = 0;
    pl.air +=
      (Math.max(0.01, WH + RIDE_H + t.wbob - Math.max(pl.gh, t.gNow - 0.4) - S.hover) - pl.air) * k;
    if ((ride.t > 1.2 && t.m0 > 0.6) || ride.t > 16) {
      ride.on = false;
      ride.cool = 4;
      pl.vy = 4.5;
      pl.boost = 0.9;
    }
  }
  const riding = ride.on || g.rides.comet.on;
  pl.rB += ((riding ? 1 : 0) - pl.rB) * (1 - Math.exp(-3 * dt));
}

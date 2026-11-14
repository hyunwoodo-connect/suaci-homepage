import * as THREE from "three";

import { resetTrail } from "./fx/ribbons";
import type { Game } from "./state";
import { S } from "./state";
import { clamp, offset, START } from "./world/sphere";
import { groundAt } from "./world/terrain";

// 나의 움직임: 끌거나 방향키로 가고, 곧게 오래 날수록 조금씩 빨라지고, 내리막에서 빨라진다. 떠오르면 천천히 활공해 내려온다

const d = new THREE.Vector3(),
  right = new THREE.Vector3(),
  axis = new THREE.Vector3(),
  tmp = new THREE.Vector3();

/** 출발점으로: 광장 곁에서 광장을 보고 선다 */
export function goHome(g: Game) {
  const { pl, rides } = g,
    { p, h, vel } = pl;
  const home = offset(START, 20, 200);
  p.copy(home);
  h.copy(START).sub(p);
  const hRadial = h.dot(p);
  h.addScaledVector(p, -hRadial).normalize();
  vel.copy(h);
  pl.spd = 0;
  pl.boost = 0;
  pl.air = 0;
  pl.vy = 0;
  pl.snap = true;
  rides.arr.on = false;
  rides.arr.t = 99;
  rides.whirl.on = false;
  rides.whale.on = false;
  rides.cannon.on = false;
  rides.balloon.on = false;
  rides.warp.on = false;
  rides.sling.on = false;
  rides.swing.on = false;
  rides.funnel.on = false;
  rides.rocket.on = false;
  rides.comet.on = false;
  rides.wing.t = 0;
  const bodyR = S.R + S.hover;
  const P0 = p.clone().multiplyScalar(bodyR);
  resetTrail(g, P0);
}

/** 이번 프레임의 입력: 끌기(또는 방향키)의 방향·세기, 놀이기구에 실려 있는지 */
export function readInput(g: Game, dt: number) {
  const { inp, keys } = g.input,
    t = g.t,
    r = g.rides;
  t.dt = dt;
  let fx = inp.drag ? inp.fx : 0,
    fy = inp.drag ? inp.fy : 0,
    m = inp.drag ? inp.m : 0;
  const kx =
    (keys.has("arrowright") || keys.has("d") ? 1 : 0) -
    (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
  const ky =
    (keys.has("arrowup") || keys.has("w") ? 1 : 0) -
    (keys.has("arrowdown") || keys.has("s") ? 1 : 0);
  if (kx || ky) {
    const l = Math.hypot(kx, ky);
    fx = kx / l;
    fy = ky / l;
    m = 1;
  }
  const m0 = m,
    held =
      r.slide.on ||
      r.whirl.on ||
      r.whale.on ||
      r.cannon.on ||
      r.warp.on ||
      r.sling.on ||
      r.swing.on ||
      r.funnel.on ||
      r.rocket.on ||
      r.comet.on;
  if (held) m = 0;
  if (g.pl.stun > 0) g.pl.stun -= dt; // 회오리·고래에 실려 있는 동안은 끌어도 움직이지 않는다
  t.fx = fx;
  t.fy = fy;
  t.m = m;
  t.m0 = m0;
  t.held = held;
}

/** 나아가기: 방향 틀기·빠르기·순항·비탈. 그리고 떠오름과 내려앉음 */
export function moveFrame(g: Game) {
  const { pl, t, rides } = g,
    { p, h, vel } = pl,
    { dt, fx, m } = t;
  if (m > 0) {
    right.crossVectors(h, p).normalize();
    d.copy(h).multiplyScalar(t.fy).addScaledVector(right, fx).normalize();
    const turnAngle = -S.turn * dt * fx * m;
    h.applyAxisAngle(p, turnAngle);
    // 튕기거나 쏘아진 직후에는 잠깐 방향이 안 먹는다
    if (pl.stun <= 0) {
      const steerDecay = -6 * dt;
      const steerEase = 1 - Math.exp(steerDecay);
      vel.lerp(d, steerEase).normalize();
    }
  }
  // 빨라질 때는 빨리, 느려질 때는 천천히 따라간다
  const spdRate = m > pl.spd ? 2.2 : 1.1;
  const spdDecay = -spdRate * dt;
  const spdEase = 1 - Math.exp(spdDecay);
  pl.spd += (m - pl.spd) * spdEase;
  const boostDecay = -0.85 * dt;
  pl.boost *= Math.exp(boostDecay);
  const gNow = groundAt(g, p);
  t.gNow = gNow;
  // 순항: 곧게 오래 날수록 조금씩 더 빨라진다. 꺾거나 멈추면 풀린다
  const isCruising = m > 0.8 && Math.abs(fx) < 0.35;
  const cruiseTarget = isCruising ? 0.9 : 0;
  const cruiseRate = isCruising ? 0.22 : 1.2;
  const cruiseDecay = -cruiseRate * dt;
  const cruiseEase = 1 - Math.exp(cruiseDecay);
  pl.cruise += (cruiseTarget - pl.cruise) * cruiseEase;
  const balloonMul = rides.balloon.on ? 0.6 : 1;
  const wingMul = rides.wing.t > 0 && pl.air > 1 ? 1.35 : 1;
  const tot = t.held ? 0 : (pl.spd * (1 + pl.sl + pl.cruise) + pl.boost) * balloonMul * wingMul;
  t.tot = tot;
  const slDecay = -3 * dt;
  if (tot > 0.002) {
    const velRadial = vel.dot(p);
    vel.addScaledVector(p, -velRadial).normalize();
    axis.crossVectors(p, vel).normalize();
    // 비탈: 내리막이면 빨라지고 오르막이면 느려진다
    const lookAhead = 1.5 / S.R;
    tmp.copy(p).applyAxisAngle(axis, lookAhead);
    const slope = pl.air < 0.6 ? (groundAt(g, tmp) - gNow) / 1.5 : 0;
    const slopePush = -slope * 1.6;
    const slTarget = clamp(slopePush, -0.35, 1.0);
    const slEase = 1 - Math.exp(slDecay);
    pl.sl += (slTarget - pl.sl) * slEase;
    const stepAngle = (S.speed / S.R) * tot * dt;
    p.applyAxisAngle(axis, stepAngle).normalize();
    const hRadial = h.dot(p);
    h.addScaledVector(p, -hRadial).normalize();
  } else pl.sl *= Math.exp(slDecay);
  // 떠오름과 내려앉음 — 천천히 활공해 내려온다
  const wing = rides.wing;
  if (wing.t > 0) wing.t -= dt;
  const G = wing.t > 0 ? 1.3 : 3.2,
    VT = wing.t > 0 ? -1.3 : -4.2; // 날개가 있으면 천천히 떨어진다
  if (!rides.whale.on && !rides.comet.on && (pl.air > 0 || pl.vy > 0)) {
    pl.vy -= G * dt;
    if (pl.vy < VT) pl.vy = VT;
    // 세계가 커진 만큼 위아래 움직임도 2.2배: 같은 시간에 2.2배 높이 솟고 2.2배 빨리 내려온다. 걸리는 시간이 같아서 착지 자리는 그대로다
    pl.air += pl.vy * 2.2 * dt;
    if (pl.air <= 0) {
      pl.air = 0;
      pl.vy = 0;
    }
  }
  const ghDecay = -5 * dt;
  const ghEase = 1 - Math.exp(ghDecay);
  pl.gh += (gNow - pl.gh) * ghEase;
  updateAlt(g);
}

/** 지금 높이(땅 + 떠 있는 높이 + 솟은 높이) */
export function updateAlt(g: Game) {
  const pl = g.pl;
  const settledGround = g.t.gNow - 0.4;
  g.t.alt = Math.max(pl.gh, settledGround) + S.hover + pl.air;
}

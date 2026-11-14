import * as THREE from "three";

import { burst } from "../fx/sparks";
import { say } from "../hud";
import type { Hold } from "../models";
import type { Game } from "../state";
import { S } from "../state";
import type { GreyMesh } from "../world/materials";
import { grey } from "../world/materials";
import { from } from "../world/sphere";
import { groundAt } from "../world/terrain";

// 큰 공 — 밀면 굴러가고, 굴러가다 종과 기둥을 건드린다. 굴릴수록 커지고, 세 배쯤 되면 펑 터져 다시 작아진다

/** 큰 공 하나 */
export interface Ball {
  m: GreyMesh;
  dist: number;
  bear: number;
  v: THREE.Vector3;
  vel: THREE.Vector3;
  sp: number;
  hit: number;
  grow?: number;
  /** 셋은 라임: 혼자 천천히 굴러다닌다 */
  lime?: Hold;
}

/** 큰 공 전체와 비치볼 무늬 */
export interface Balls {
  list: Ball[];
  beachTex2: THREE.CanvasTexture;
}

const tmp = new THREE.Vector3(),
  axis2 = new THREE.Vector3();

/** 큰 공을 만든다 */
export function createBalls(g: Game): Balls {
  const dotMat = grey(g.mats, 0x9ea3a2);
  const beachTex2 = (() => {
    // 수아시 톤의 비치볼: 흰색과 옅은 분홍
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 256;
    const c = cv.getContext("2d")!;
    ["#ff5a1f", "#ffffff", "#ffd21f", "#ffffff", "#ff5a1f", "#ffffff"].forEach((col, i) => {
      c.fillStyle = col;
      const stripeX = (i * 512) / 6;
      const stripeW = 512 / 6 + 1;
      c.fillRect(stripeX, 0, stripeW, 256);
    });
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const dirs = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const list = g.L.ball.map(({ dist, bear }) => {
    const ballGeo = new THREE.SphereGeometry(2.2, 24, 16);
    const ballMat = grey(g.mats, 0xc4c8c7);
    const m = new THREE.Mesh(ballGeo, ballMat);
    for (const a of dirs) {
      const dotGeo = new THREE.SphereGeometry(0.5, 10, 8);
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(a[0], a[1], a[2]).multiplyScalar(2);
      m.add(dot);
    }
    g.scene.add(m);
    return {
      m,
      dist,
      bear,
      v: new THREE.Vector3(),
      vel: new THREE.Vector3(1, 0, 0),
      sp: 0,
      hit: 0,
    };
  });
  return { list, beachTex2 };
}

/** 큰 공 자리(멈춘 채로) */
export function layoutBalls(g: Game, keep: THREE.Vector3[]) {
  for (const b of g.balls.list) {
    const spot = from(b.dist, b.bear);
    b.v.copy(spot);
    b.sp = 0;
    const kept = b.v.clone();
    keep.push(kept);
  }
}

/** 큰 공: 밀면 굴러가며 커지고, 종·기둥·범퍼를 건드린다 */
export function ballsFrame(g: Game) {
  const { pl, t, time } = g,
    { p, vel } = pl,
    dt = t.dt,
    bumps = g.terrain.bumps;
  for (const b of g.balls.list) {
    // 가만히 있을 때 들썩인다. 굴릴수록 커진다
    const growth = b.grow || 0;
    const bobPhase = time * 3.2 + b.dist;
    const bob = b.sp > 0.05 ? 0 : 0.035 * Math.sin(bobPhase);
    const ballScale = (1 + growth) * (1 + bob);
    b.m.scale.setScalar(ballScale);
    if (b.hit > 0) b.hit -= dt;
    else if (!t.held && pl.air < 3 + 4 * growth && p.angleTo(b.v) * S.R < 3.1 + 2.2 * growth) {
      // 나에게서 공 쪽으로(땅에 붙은 접선 방향) 민다
      tmp.copy(b.v).sub(p);
      const pushAlong = tmp.dot(b.v);
      tmp.addScaledVector(b.v, -pushAlong);
      if (tmp.lengthSq() < 1e-12) tmp.copy(vel);
      tmp.normalize();
      b.vel.copy(tmp).addScaledVector(vel, 0.5);
      const velAlong = b.vel.dot(b.v);
      b.vel.addScaledVector(b.v, -velAlong).normalize();
      const pushTot = Math.max(t.tot, 0.7);
      const pushSpeed = S.speed * pushTot * 1.6;
      b.sp = Math.max(b.sp, pushSpeed);
      b.hit = 0.4;
      if (!g.said.ball) {
        g.said.ball = true;
        say(g, "큰 공 — 밀면 굴러갑니다");
      }
    }
    if (b.sp > 0.05) {
      axis2.crossVectors(b.v, b.vel).normalize();
      const a = (b.sp * dt) / S.R;
      b.v.applyAxisAngle(axis2, a).normalize();
      b.vel.applyAxisAngle(axis2, a);
      const velAlong = b.vel.dot(b.v);
      b.vel.addScaledVector(b.v, -velAlong).normalize();
      const spin = (b.sp * dt) / 2.2;
      b.m.rotateOnWorldAxis(axis2, spin);
      const frictionRate = -0.45 * dt;
      b.sp *= Math.exp(frictionRate);
      if (b.sp > 2.5) {
        // 밀어서 굴릴수록 커지고, 세 배쯤 되면 펑 터져 다시 작아진다
        if (!b.grow && !g.said.grow) {
          g.said.grow = true;
          say(g, "굴릴수록 커집니다");
        }
        b.grow = (b.grow || 0) + b.sp * dt * 0.012;
        if (b.grow > 1.9) {
          for (let k = 0; k < 3; k++) {
            const popAt = b.m.position.clone();
            const popPower = 10 + k * 5;
            burst(g, popAt, 20, popPower);
          }
          b.grow = 0;
          b.sp *= 0.3;
          say(g, "펑 — 다시 작아졌습니다");
          for (let k = 0; k < bumps.v.length; k++)
            if (2 * (1 - b.v.dot(bumps.v[k])) * S.R * S.R < 1600) bumps.lit[k] = 1;
        }
      }
      for (const c of g.chimes) if (c.lit < 0.3 && c.v.angleTo(b.v) * S.R < 2.8) c.lit = 1;
      for (const pll of g.pillars.list) if (pll.v.angleTo(b.v) * S.R < 2.8) pll.lit = 1;
      for (const bm of g.bumpers)
        if (bm.cool <= 0 && bm.v.angleTo(b.v) * S.R < 4) {
          bm.lit = 1;
          bm.cool = 0.35;
          tmp.copy(b.v).sub(bm.v);
          const normalAlong = tmp.dot(b.v);
          tmp.addScaledVector(b.v, -normalAlong).normalize();
          const vn = b.vel.dot(tmp);
          if (vn < 0) {
            const reflect = -2 * vn;
            b.vel.addScaledVector(tmp, reflect).normalize();
          }
        }
    }
    const ground = groundAt(g, b.v);
    const radius = 2.2 * (1 + (b.grow || 0));
    const centerR = S.R + ground + radius;
    b.m.position.copy(b.v).multiplyScalar(centerR);
  }
}

/** 라임 공은 혼자 천천히 굴러다닌다 */
export function limeBallsFrame(g: Game) {
  for (const b of g.balls.list)
    if (b.lime) {
      if (b.sp < 1.3) b.sp = 1.3;
      const wander = g.t.dt * 0.22;
      b.vel.applyAxisAngle(b.v, wander);
    }
}

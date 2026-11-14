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
      c.fillRect((i * 512) / 6, 0, 512 / 6 + 1, 256);
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
    const m = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), grey(g.mats, 0xc4c8c7));
    for (const a of dirs) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), dotMat);
      dot.position.set(a[0] * 2, a[1] * 2, a[2] * 2);
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
    b.v.copy(from(b.dist, b.bear));
    b.sp = 0;
    keep.push(b.v.clone());
  }
}

/** 큰 공: 밀면 굴러가며 커지고, 종·기둥·범퍼를 건드린다 */
export function ballsFrame(g: Game) {
  const { pl, t, time } = g,
    { p, vel } = pl,
    dt = t.dt,
    bumps = g.terrain.bumps;
  for (const b of g.balls.list) {
    b.m.scale.setScalar(
      (1 + (b.grow || 0)) * (1 + (b.sp > 0.05 ? 0 : 0.035 * Math.sin(time * 3.2 + b.dist))),
    ); // 가만히 있을 때 들썩인다. 굴릴수록 커진다
    if (b.hit > 0) b.hit -= dt;
    else if (
      !t.held &&
      pl.air < 3 + 4 * (b.grow || 0) &&
      p.angleTo(b.v) * S.R < 3.1 + 2.2 * (b.grow || 0)
    ) {
      tmp.copy(b.v).sub(p);
      tmp.addScaledVector(b.v, -tmp.dot(b.v));
      if (tmp.lengthSq() < 1e-12) tmp.copy(vel);
      tmp.normalize();
      b.vel.copy(tmp).addScaledVector(vel, 0.5);
      b.vel.addScaledVector(b.v, -b.vel.dot(b.v)).normalize();
      b.sp = Math.max(b.sp, S.speed * Math.max(t.tot, 0.7) * 1.6);
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
      b.vel.addScaledVector(b.v, -b.vel.dot(b.v)).normalize();
      b.m.rotateOnWorldAxis(axis2, (b.sp * dt) / 2.2);
      b.sp *= Math.exp(-0.45 * dt);
      if (b.sp > 2.5) {
        // 밀어서 굴릴수록 커지고, 세 배쯤 되면 펑 터져 다시 작아진다
        if (!b.grow && !g.said.grow) {
          g.said.grow = true;
          say(g, "굴릴수록 커집니다");
        }
        b.grow = (b.grow || 0) + b.sp * dt * 0.012;
        if (b.grow > 1.9) {
          for (let k = 0; k < 3; k++) burst(g, b.m.position.clone(), 20, 10 + k * 5);
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
          tmp.addScaledVector(b.v, -tmp.dot(b.v)).normalize();
          const vn = b.vel.dot(tmp);
          if (vn < 0) b.vel.addScaledVector(tmp, -2 * vn).normalize();
        }
    }
    b.m.position.copy(b.v).multiplyScalar(S.R + groundAt(g, b.v) + 2.2 * (1 + (b.grow || 0)));
  }
}

/** 라임 공은 혼자 천천히 굴러다닌다 */
export function limeBallsFrame(g: Game) {
  for (const b of g.balls.list)
    if (b.lime) {
      if (b.sp < 1.3) b.sp = 1.3;
      b.vel.applyAxisAngle(b.v, g.t.dt * 0.22);
    }
}

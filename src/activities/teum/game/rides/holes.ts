import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { GREY_TOY, S } from "../state";
import type { GreyMesh } from "../world/materials";
import { grey } from "../world/materials";
import { from, UP } from "../world/sphere";
import { featGround, groundAt } from "../world/terrain";

// 구름 구멍 — 들어가면 멀리 있는 짝 구멍으로 튀어나온다

/** 구멍 하나: pi 짝 번호, k 짝 안에서 0·1 */
export interface Hole {
  g: THREE.Group;
  rim: GreyMesh;
  dist: number;
  bear: number;
  pi: number;
  k: number;
  v: THREE.Vector3;
  cool: number;
  lit: number;
}

/** 구멍을 지나는 동안: a 들어간 곳, b 나올 곳, done 나왔나 */
export interface Warp {
  on: boolean;
  t: number;
  a: Hole | null;
  b: Hole | null;
  done: boolean;
}

/** 구멍을 만든다(자리표에서 둘씩 짝) */
export function createHoles(g: Game): Hole[] {
  const holes: Hole[] = [];
  const pairs = g.L.hole.reduce<[number, number][][]>((a, o, i) => {
    if (i % 2) a[a.length - 1].push([o.dist, o.bear]);
    else a.push([[o.dist, o.bear]]);
    return a;
  }, []);
  pairs.forEach((pair, pi) =>
    pair.forEach(([dist, bear], k) => {
      const gr = new THREE.Group();
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(3, 32),
        new THREE.MeshBasicMaterial({ color: 0x6f7473 }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.08;
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(3.1, 0.55, 10, 40),
        grey(g.mats, GREY_TOY),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.15;
      gr.add(disc, rim);
      g.scene.add(gr);
      holes.push({ g: gr, rim, dist, bear, pi, k, v: new THREE.Vector3(), cool: 0, lit: 0 });
    }),
  );
  return holes;
}

/** 구멍 자리 */
export function layoutHoles(g: Game, keep: THREE.Vector3[]) {
  for (const ho of g.holes) {
    ho.v.copy(from(ho.dist, ho.bear));
    keep.push(ho.v);
    ho.g.position.copy(ho.v).multiplyScalar(S.R + featGround(g, ho.v));
    ho.g.quaternion.setFromUnitVectors(UP, ho.v);
  }
}

/** 구름 구멍: 들어가면 빨려 들어갔다가 짝 구멍에서 튀어나온다 */
export function holesFrame(g: Game) {
  const { pl, t } = g,
    { p, h, vel } = pl,
    dt = t.dt,
    warp = g.rides.warp,
    holes = g.holes,
    TC = g.mats.toy,
    lime = g.mats.lime;
  for (const ho of holes) {
    if (ho.cool > 0) ho.cool -= dt;
    else if (!t.held && !warp.on && pl.air < 1 && p.angleTo(ho.v) * S.R < 2.5) {
      warp.on = true;
      warp.t = 0;
      warp.a = ho;
      warp.b = holes[ho.pi * 2 + (1 - ho.k)];
      warp.done = false;
      say(g, "구름 구멍 — 멀리 있는 짝 구멍으로 나옵니다");
    }
    ho.lit = Math.max(0, ho.lit - dt * 0.8);
    ho.rim.material.color.copy(TC.hole).lerp(lime, ho.lit);
  }
  if (warp.on) {
    warp.t += dt;
    if (!warp.done) {
      const a = warp.a!,
        b = warp.b!;
      p.lerp(a.v, 1 - Math.exp(-12 * dt)).normalize();
      if (warp.t > 0.45) {
        warp.done = true;
        p.copy(b.v);
        h.addScaledVector(p, -h.dot(p)).normalize();
        vel.copy(h);
        pl.snap = true;
        pl.gh = groundAt(g, p);
        pl.trailReset = true;
        a.cool = 3;
        b.cool = 3;
        a.lit = 1;
        b.lit = 1;
        pl.vy = 8.5;
        pl.air = 0.01;
        pl.boost = 0;
      }
    } else if (warp.t > 0.8) warp.on = false;
  }
}

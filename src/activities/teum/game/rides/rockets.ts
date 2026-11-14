import * as THREE from "three";

import { burst } from "../fx/sparks";
import { say } from "../hud";
import type { Game } from "../state";
import { GREY_TOY, S } from "../state";
import { grey } from "../world/materials";
import { from, UP } from "../world/sphere";
import { featGround } from "../world/terrain";

// 로켓 풍선 — 올라타면 덜덜 떨다가 하늘 끝까지 솟구친다

/** 로켓 하나 */
export interface Rocket {
  g: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  dist: number;
  bear: number;
  v: THREE.Vector3;
  gnd: number;
  cool: number;
}

/** 로켓에 타 있는 동안 */
export interface RocketRide {
  on: boolean;
  t: number;
  o: Rocket | null;
}

/** 로켓을 만든다 */
export function createRockets(g: Game): Rocket[] {
  return g.L.rocket.map(({ dist, bear }) => {
    const gr = new THREE.Group(),
      mat = grey(g.mats, GREY_TOY);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.15, 2.4, 8, 18), mat);
    body.position.y = 2.9;
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3,
        fin = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 10), mat);
      fin.scale.set(1, 1.5, 0.45);
      fin.position.set(Math.cos(a) * 1.25, 1.1, Math.sin(a) * 1.25);
      fin.rotation.y = -a;
      gr.add(fin);
    }
    const win = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), g.pillars.core);
    win.position.set(0, 3.6, 1.0);
    gr.add(body, win);
    g.scene.add(gr);
    return { g: gr, mat, dist, bear, v: new THREE.Vector3(), gnd: 0, cool: 0 };
  });
}

/** 로켓 자리 */
export function layoutRockets(g: Game, keep: THREE.Vector3[]) {
  for (const o of g.rockets) {
    o.v.copy(from(o.dist, o.bear));
    o.gnd = featGround(g, o.v);
    keep.push(o.v);
    o.g.position.copy(o.v).multiplyScalar(S.R + o.gnd);
    o.g.quaternion.setFromUnitVectors(UP, o.v);
  }
}

/** 로켓: 올라타면 떨다가 솟구친다 */
export function rocketsFrame(g: Game) {
  const { pl, t } = g,
    { p, P } = pl,
    dt = t.dt,
    rocket = g.rides.rocket,
    TC = g.mats.toy,
    lime = g.mats.lime;
  for (const o of g.rockets) {
    if (o.cool > 0) o.cool -= dt;
    else if (!t.held && !rocket.on && pl.air < 3 && p.angleTo(o.v) * S.R < 3.2) {
      rocket.on = true;
      rocket.t = 0;
      rocket.o = o;
      say(g, "로켓 풍선 — 하늘 끝까지 솟구칩니다");
    }
    o.mat.color.copy(TC.rocket).lerp(lime, rocket.on && rocket.o === o ? 1 : 0);
  }
  if (rocket.on) {
    const o = rocket.o!;
    rocket.t += dt;
    p.lerp(o.v, 1 - Math.exp(-12 * dt)).normalize();
    if (rocket.t < 0.9) {
      pl.air += (3.4 - pl.air) * (1 - Math.exp(-10 * dt));
      pl.vy = 0;
    } // 덜덜 떠는 동안
    else {
      pl.vy = 24;
      if (Math.random() < 0.6) burst(g, P.clone().addScaledVector(p, -3), 1, 4);
    }
    if (rocket.t > 3.3) {
      rocket.on = false;
      o.cool = 6;
      pl.vy = 10;
      pl.boost = 0.6;
    }
  }
}

/** 로켓 모양: 타고 있을 때는 내 발밑에 붙어 같이 올라가고, 떨면서 기다린다 */
export function rocketsPose(g: Game) {
  const { pl, time } = g,
    { p, h, P } = pl,
    rocket = g.rides.rocket;
  for (const o of g.rockets) {
    const mine = rocket.on && rocket.o === o;
    o.g.visible = mine || o.cool <= 0;
    if (mine) {
      o.g.position.copy(P).addScaledVector(p, -4.6);
      if (rocket.t < 0.9) o.g.position.addScaledVector(h, Math.sin(time * 70) * 0.12);
      o.g.quaternion.setFromUnitVectors(UP, p);
    } else {
      o.g.position.copy(o.v).multiplyScalar(S.R + o.gnd);
      o.g.quaternion.setFromUnitVectors(UP, o.v);
    }
  }
}

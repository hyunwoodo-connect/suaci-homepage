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
    const bodyGeo = new THREE.CapsuleGeometry(1.15, 2.4, 8, 18);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 2.9;
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3;
      const finGeo = new THREE.SphereGeometry(0.75, 12, 10);
      const fin = new THREE.Mesh(finGeo, mat);
      fin.scale.set(1, 1.5, 0.45);
      const finX = Math.cos(a) * 1.25;
      const finZ = Math.sin(a) * 1.25;
      fin.position.set(finX, 1.1, finZ);
      fin.rotation.y = -a;
      gr.add(fin);
    }
    const winGeo = new THREE.SphereGeometry(0.5, 14, 10);
    const win = new THREE.Mesh(winGeo, g.pillars.core);
    win.position.set(0, 3.6, 1.0);
    gr.add(body, win);
    g.scene.add(gr);
    return { g: gr, mat, dist, bear, v: new THREE.Vector3(), gnd: 0, cool: 0 };
  });
}

/** 로켓 자리 */
export function layoutRockets(g: Game, keep: THREE.Vector3[]) {
  for (const o of g.rockets) {
    const spot = from(o.dist, o.bear);
    o.v.copy(spot);
    o.gnd = featGround(g, o.v);
    keep.push(o.v);
    const groundR = S.R + o.gnd;
    o.g.position.copy(o.v).multiplyScalar(groundR);
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
    const isRiding = rocket.on && rocket.o === o;
    const glow = isRiding ? 1 : 0;
    o.mat.color.copy(TC.rocket).lerp(lime, glow);
  }
  if (rocket.on) {
    const o = rocket.o!;
    rocket.t += dt;
    const snapRate = -12 * dt;
    const snap = 1 - Math.exp(snapRate);
    p.lerp(o.v, snap).normalize();
    if (rocket.t < 0.9) {
      // 덜덜 떠는 동안
      const hoverRate = -10 * dt;
      const hoverEase = 1 - Math.exp(hoverRate);
      pl.air += (3.4 - pl.air) * hoverEase;
      pl.vy = 0;
    } else {
      pl.vy = 24;
      if (Math.random() < 0.6) {
        const exhaust = P.clone().addScaledVector(p, -3);
        burst(g, exhaust, 1, 4);
      }
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
      if (rocket.t < 0.9) {
        const shakePhase = time * 70;
        const shake = Math.sin(shakePhase) * 0.12;
        o.g.position.addScaledVector(h, shake);
      }
      o.g.quaternion.setFromUnitVectors(UP, p);
    } else {
      const groundR = S.R + o.gnd;
      o.g.position.copy(o.v).multiplyScalar(groundR);
      o.g.quaternion.setFromUnitVectors(UP, o.v);
    }
  }
}

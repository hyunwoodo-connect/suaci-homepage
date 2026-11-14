import * as THREE from "three";

import { burst } from "../fx/sparks";
import { say } from "../hud";
import type { Game } from "../state";
import { S } from "../state";
import { from } from "../world/sphere";

// 혜성 — 하늘을 빠르게 가로지른다. 높이 떠 있을 때 닿으면 올라타 멀리 날아간다

/** 혜성 */
export interface Comet {
  g: THREE.Group;
  mat: THREE.MeshBasicMaterial;
  v: THREE.Vector3;
  f: THREE.Vector3;
}

/** 혜성에 타 있는 동안 */
export interface CometRide {
  on: boolean;
  t: number;
  cool: number;
}

/** 혜성이 나는 높이 */
const CH = 46;

const bx = new THREE.Vector3(),
  m4 = new THREE.Matrix4();

/** 혜성을 만든다 */
export function createComet(g: Game): Comet {
  const gr = new THREE.Group(),
    mat = new THREE.MeshBasicMaterial({ color: 0xffd21f, fog: false });
  {
    const ballGeo = new THREE.SphereGeometry(2.2, 20, 14);
    const ball = new THREE.Mesh(ballGeo, mat);
    const tailGeo = new THREE.ConeGeometry(1.9, 15, 16, 1, true);
    const tailMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      fog: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const tail = new THREE.Mesh(tailGeo, tailMat);
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -8;
    gr.add(ball, tail);
    g.scene.add(gr);
  }
  return { g: gr, mat, v: new THREE.Vector3(), f: new THREE.Vector3() };
}

/** 혜성: 하늘을 돌고, 높이 떠서 닿으면 올라타며, 끌면 뛰어내린다 */
export function cometFrame(g: Game) {
  const { pl, t, time } = g,
    { p, h, vel } = pl,
    dt = t.dt,
    cride = g.rides.comet,
    C = g.comet;
  const cdeg = ((time * 26) / (120 * S.wide)) * 57.2958 + 40;
  const cometSpot = from(120, -cdeg);
  C.v.copy(cometSpot);
  const aheadDeg = -cdeg - 1;
  const aheadSpot = from(120, aheadDeg);
  C.f.copy(aheadSpot).sub(C.v);
  const fUp = C.f.dot(C.v);
  C.f.addScaledVector(C.v, -fUp).normalize();
  const cometRadius = S.R + CH;
  C.g.position.copy(C.v).multiplyScalar(cometRadius);
  bx.crossVectors(C.v, C.f).normalize().negate();
  m4.makeBasis(C.f, C.v, bx);
  C.g.quaternion.setFromRotationMatrix(m4);
  const cometLit = cride.on ? 1 : 0;
  C.mat.color.copy(g.mats.toy.comet).lerp(g.mats.lime, cometLit);
  if (cride.cool > 0) cride.cool -= dt;
  const altOffset = t.alt - CH;
  if (
    !cride.on &&
    cride.cool <= 0 &&
    !t.held &&
    pl.air > 6 &&
    p.angleTo(C.v) * S.R < 16 &&
    Math.abs(altOffset) < 13
  ) {
    cride.on = true;
    cride.t = 0;
    say(g, "혜성 — 끌면 뛰어내립니다");
  }
  if (cride.on) {
    cride.t += dt;
    const decay = -7 * dt;
    const k = 1 - Math.exp(decay);
    p.lerp(C.v, k).normalize();
    h.lerp(C.f, k);
    const hUp = h.dot(p);
    h.addScaledVector(p, -hUp).normalize();
    vel.copy(h);
    pl.vy = 0;
    const groundNow = t.gNow - 0.4;
    const floorAlt = Math.max(pl.gh, groundNow);
    const rideAir = CH + 2.9 - floorAlt - S.hover;
    const targetAir = Math.max(0.01, rideAir);
    pl.air += (targetAir - pl.air) * k;
    if (Math.random() < 0.5) {
      const tailPos = C.g.position.clone().addScaledVector(C.f, -6);
      burst(g, tailPos, 1, 3);
    }
    if ((cride.t > 1 && t.m0 > 0.6) || cride.t > 16) {
      cride.on = false;
      cride.cool = 5;
      pl.vy = 5;
      pl.boost = 3.2;
      pl.stun = 0.6;
    }
  }
}

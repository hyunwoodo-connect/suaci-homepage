import * as THREE from "three";

import { say } from "../hud";
import type { Hold } from "../models";
import type { Game } from "../state";
import { GREY_TOY, S } from "../state";
import type { HeadedSpot } from "../world/layout";
import type { GreyMesh } from "../world/materials";
import { grey } from "../world/materials";
import { from, heading } from "../world/sphere";
import { featGround } from "../world/terrain";
import { basis } from "./bars";

// 대포 — 들어가면 잠깐 움츠렸다가 멀리 쏘아 올려진다

/** 대포 하나 */
export interface Cannon extends HeadedSpot {
  g: THREE.Group;
  barrel: GreyMesh;
  v: THREE.Vector3;
  d: THREE.Vector3;
  cool: number;
  lit: number;
  model?: Hold;
}

/** 대포에 들어가 있는 동안 */
export interface CannonRide {
  on: boolean;
  t: number;
  c: Cannon | null;
}

/** 대포를 만든다 */
export function createCannons(g: Game): Cannon[] {
  return g.L.cannon.map((c) => {
    const gr = new THREE.Group();
    const base = new THREE.Mesh(new THREE.SphereGeometry(2.8, 22, 14), grey(g.mats, 0xb0b4b3));
    base.scale.y = 0.45;
    base.position.y = 0.5;
    g.mats.poles.push(base.material);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.9, 5, 18, 1, true),
      grey(g.mats, GREY_TOY),
    );
    barrel.material.side = THREE.DoubleSide;
    barrel.rotation.x = Math.PI / 4;
    barrel.position.set(0, 2.6, 1.4);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.45, 10, 28), barrel.material);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 2.5;
    barrel.add(lip); // 부푼 주둥이
    gr.add(base, barrel);
    g.scene.add(gr);
    return { ...c, g: gr, barrel, v: new THREE.Vector3(), d: new THREE.Vector3(), cool: 0, lit: 0 };
  });
}

/** 대포 자리: 쏘는 방향(head)을 보게 */
export function layoutCannons(g: Game, keep: THREE.Vector3[]) {
  for (const c of g.cannons) {
    c.v.copy(from(c.dist, c.bear));
    c.d.copy(heading(c.v, c.head));
    keep.push(c.v);
    c.g.position.copy(c.v).multiplyScalar(S.R + featGround(g, c.v));
    basis(c.g, c.v, c.d);
  }
}

/** 대포: 들어가면 움츠렸다가 쏘아 올린다 */
export function cannonsFrame(g: Game) {
  const { pl, t } = g,
    { p, h, vel } = pl,
    dt = t.dt,
    cannon = g.rides.cannon,
    TC = g.mats.toy,
    lime = g.mats.lime;
  for (const c of g.cannons) {
    if (c.cool > 0) c.cool -= dt;
    else if (!t.held && !cannon.on && pl.air < 2 && p.angleTo(c.v) * S.R < 3.4) {
      cannon.on = true;
      cannon.t = 0;
      cannon.c = c;
      say(g, "대포 — 멀리 쏘아 올려집니다");
    }
    c.lit = Math.max(0, c.lit - dt);
    c.barrel.material.color.copy(TC.cannon).lerp(lime, c.lit);
  }
  if (cannon.on) {
    const c = cannon.c!;
    cannon.t += dt;
    p.lerp(c.v, 1 - Math.exp(-10 * dt)).normalize();
    h.lerp(c.d, 1 - Math.exp(-6 * dt));
    h.addScaledVector(p, -h.dot(p)).normalize();
    pl.air += (1.6 - pl.air) * (1 - Math.exp(-8 * dt));
    pl.vy = 0;
    if (cannon.t > 0.75) {
      cannon.on = false;
      c.cool = 3;
      c.lit = 1;
      vel.copy(c.d);
      pl.boost = 6;
      pl.vy = 10.5;
      pl.stun = 1.2;
    }
  }
}

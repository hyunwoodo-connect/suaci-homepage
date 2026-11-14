import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { GREY_TOY, S } from "../state";
import { grey } from "../world/materials";
import { from, UP } from "../world/sphere";
import { featGround } from "../world/terrain";

// 깔때기 — 가장자리를 돌며 빨라지다 가운데로 빨려들고, 하늘로 솟구친다

/** 깔때기 하나 */
export interface Funnel {
  g: THREE.Group;
  mats: THREE.MeshStandardMaterial[];
  dist: number;
  bear: number;
  v: THREE.Vector3;
  cool: number;
  lit: number;
}

/** 깔때기에 빨려 드는 동안: 남은 반지름 r, 도는 쪽 sgn */
export interface FunnelRide {
  on: boolean;
  f: Funnel | null;
  r: number;
  sgn: number;
}

const tmp = new THREE.Vector3();

/** 깔때기를 만든다 */
export function createFunnels(g: Game): Funnel[] {
  return g.L.funnel.map(({ dist, bear }) => {
    const gr = new THREE.Group(),
      mats: THREE.MeshStandardMaterial[] = [];
    [21, 16.5, 12, 7.5, 3.5].forEach((r) => {
      const ringGeo = new THREE.TorusGeometry(r, 0.5, 10, 64);
      const ringMat = grey(g.mats, GREY_TOY);
      const t = new THREE.Mesh(ringGeo, ringMat);
      t.rotation.x = Math.PI / 2;
      t.position.y = 0.5;
      gr.add(t);
      mats.push(t.material);
    });
    const holeGeo = new THREE.CircleGeometry(2.6, 28);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x6f7473 });
    const c = new THREE.Mesh(holeGeo, holeMat);
    c.rotation.x = -Math.PI / 2;
    c.position.y = 0.45;
    gr.add(c);
    g.scene.add(gr);
    return { g: gr, mats, dist, bear, v: new THREE.Vector3(), cool: 0, lit: 0 };
  });
}

/** 깔때기 자리(언덕이 덮지 않게 넓은 자리로) */
export function layoutFunnels(g: Game) {
  for (const f of g.funnels) {
    const spot = from(f.dist, f.bear);
    f.v.copy(spot);
    g.zones.push({ v: f.v, r: 23 });
    const radius = S.R + featGround(g, f.v);
    f.g.position.copy(f.v).multiplyScalar(radius);
    f.g.quaternion.setFromUnitVectors(UP, f.v);
  }
}

/** 깔때기: 가장자리에 들어가면 돌며 빨려들고, 가운데서 솟구친다 */
export function funnelsFrame(g: Game) {
  const { pl, t } = g,
    { p, h, vel } = pl,
    dt = t.dt,
    funnel = g.rides.funnel,
    TC = g.mats.toy,
    lime = g.mats.lime;
  for (const f of g.funnels) {
    if (f.cool > 0) f.cool -= dt;
    else if (!t.held && !funnel.on && pl.air < 2.5) {
      const r = p.angleTo(f.v) * S.R;
      if (r < 21 && r > 3) {
        funnel.on = true;
        funnel.f = f;
        funnel.r = r;
        g.rides.whirl.h0.copy(h);
        funnel.sgn = tmp.crossVectors(f.v, p).dot(vel) >= 0 ? 1 : -1;
        say(g, "깔때기 — 빙글빙글 돌며 빨려듭니다");
      }
    }
    const dimmed = f.lit - dt * 0.7;
    f.lit = Math.max(0, dimmed);
    for (const mt of f.mats) mt.color.copy(TC.funnel).lerp(lime, f.lit);
  }
  if (funnel.on) {
    const f = funnel.f!;
    const shrinkRate = 2.4 + (21 - funnel.r) * 0.12;
    const shrunk = funnel.r - dt * shrinkRate;
    funnel.r = Math.max(0, shrunk);
    const r = Math.max(funnel.r, 0.6);
    const pUp = p.dot(f.v);
    tmp.copy(p).addScaledVector(f.v, -pUp);
    if (tmp.lengthSq() < 1e-12) tmp.copy(h);
    tmp.normalize();
    const rimAngle = r / S.R;
    p.copy(f.v).addScaledVector(tmp, rimAngle).normalize();
    const orbitSpeed = (S.speed * (1.3 + (21 - r) * 0.16)) / r;
    const angularSpeed = Math.min(8, orbitSpeed);
    const turn = funnel.sgn * angularSpeed * dt;
    p.applyAxisAngle(f.v, turn).normalize();
    h.crossVectors(f.v, p).multiplyScalar(funnel.sgn);
    const hUp = h.dot(p);
    h.addScaledVector(p, -hUp).normalize();
    vel.copy(h);
    pl.vy = 0;
    const airDecay = -6 * dt;
    const airPull = 1 - Math.exp(airDecay);
    pl.air += (0.2 - pl.air) * airPull;
    const closeness = 1 - r / 21;
    f.lit = Math.max(f.lit, closeness);
    if (funnel.r <= 1.2) {
      funnel.on = false;
      f.cool = 5;
      f.lit = 1;
      pl.vy = 14;
      pl.air = 0.01;
      pl.boost = 0.4;
      pl.stun = 0.5;
    }
  }
}

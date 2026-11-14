import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { GREY_TOY, S } from "../state";
import type { HeadedSpot } from "../world/layout";
import type { GreyMesh } from "../world/materials";
import { grey } from "../world/materials";
import { cyl } from "../world/shapes";
import { from, heading, UP } from "../world/sphere";
import { featGround } from "../world/terrain";
import { placeBar } from "./bars";

// 고무줄 — 두 기둥 사이 줄에 부딪히면 쭉 늘어났다가 반대로 튕겨 날아간다

/** 고무줄 하나: 기둥 둘(pa·pb)과 줄 둘(ba·bb), 줄 끝(A·B)·가운데(C)·지금 당겨진 자리(mid) */
export interface Sling extends HeadedSpot {
  pa: GreyMesh;
  pb: GreyMesh;
  ba: GreyMesh;
  bb: GreyMesh;
  v: THREE.Vector3;
  d: THREE.Vector3;
  side: THREE.Vector3;
  A: THREE.Vector3;
  B: THREE.Vector3;
  C: THREE.Vector3;
  mid: THREE.Vector3;
  cool: number;
  lit: number;
}

/** 고무줄에 걸려 있는 동안 */
export interface SlingRide {
  on: boolean;
  t: number;
  s: Sling | null;
  /** 들어온 방향(+1 앞, -1 뒤) */
  inc: number;
  s0: THREE.Vector3;
}

const tmp = new THREE.Vector3();

/** 고무줄과 그 줄 모양(그네도 같이 쓴다) */
export function createSlings(g: Game): { list: Sling[]; barGeo: THREE.CylinderGeometry } {
  const barGeo = new THREE.CylinderGeometry(0.22, 0.22, 1, 10);
  const list = g.L.sling.map((c) => {
    const pa = cyl(g.mats, 0.35, 4.4, 0xa9adac),
      pb = cyl(g.mats, 0.35, 4.4, 0xa9adac);
    for (const m of [pa, pb]) {
      m.geometry = new THREE.CapsuleGeometry(0.5, 3.4, 6, 14).translate(0, 2.2, 0);
      m.position.y = 0;
      g.mats.poles.push(m.material);
    }
    const ba = new THREE.Mesh(barGeo, grey(g.mats, GREY_TOY)),
      bb = new THREE.Mesh(barGeo, grey(g.mats, GREY_TOY));
    g.scene.add(pa, pb, ba, bb);
    return {
      ...c,
      pa,
      pb,
      ba,
      bb,
      v: new THREE.Vector3(),
      d: new THREE.Vector3(),
      side: new THREE.Vector3(),
      A: new THREE.Vector3(),
      B: new THREE.Vector3(),
      C: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      cool: 0,
      lit: 0,
    };
  });
  return { list, barGeo };
}

/** 고무줄 자리: 기둥 둘을 옆으로 벌려 세운다 */
export function layoutSlings(g: Game, keep: THREE.Vector3[]) {
  for (const sg of g.slings) {
    sg.v.copy(from(sg.dist, sg.bear));
    sg.d.copy(heading(sg.v, sg.head));
    sg.side.crossVectors(sg.v, sg.d).normalize();
    keep.push(sg.v);
    const gr = featGround(g, sg.v),
      a = sg.v
        .clone()
        .addScaledVector(sg.side, 5 / S.R)
        .normalize(),
      b = sg.v
        .clone()
        .addScaledVector(sg.side, -5 / S.R)
        .normalize();
    sg.pa.position.copy(a).multiplyScalar(S.R + gr);
    sg.pa.quaternion.setFromUnitVectors(UP, a);
    sg.pb.position.copy(b).multiplyScalar(S.R + gr);
    sg.pb.quaternion.setFromUnitVectors(UP, b);
    sg.A.copy(a).multiplyScalar(S.R + gr + 2.4);
    sg.B.copy(b).multiplyScalar(S.R + gr + 2.4);
    sg.C.copy(sg.v).multiplyScalar(S.R + gr + 2.4);
    sg.mid.copy(sg.C);
  }
}

/** 고무줄: 줄에 닿으면 쭉 당겨졌다가 반대로 튕긴다 */
export function slingsFrame(g: Game) {
  const { pl, t } = g,
    { p, vel } = pl,
    dt = t.dt,
    sling = g.rides.sling,
    TC = g.mats.toy,
    lime = g.mats.lime;
  for (const sg of g.slings) {
    if (sg.cool > 0) sg.cool -= dt;
    else if (!t.held && !sling.on && pl.air < 4 && t.tot > 0.3) {
      tmp.copy(p).sub(sg.v);
      const along = tmp.dot(sg.d) * S.R,
        lat = tmp.dot(sg.side) * S.R;
      if (Math.abs(along) < 1.3 && Math.abs(lat) < 4.6) {
        sling.on = true;
        sling.t = 0;
        sling.s = sg;
        sling.inc = vel.dot(sg.d) >= 0 ? 1 : -1;
        sling.s0.copy(p);
        say(g, "고무줄 — 쭉 늘어났다가 튕겨 날아갑니다");
      }
    }
    sg.lit = Math.max(0, sg.lit - dt * 0.8);
    sg.ba.material.color.copy(TC.sling).lerp(lime, sg.lit);
    sg.bb.material.color.copy(sg.ba.material.color);
  }
  if (sling.on) {
    const sg = sling.s!;
    sling.t += dt;
    const k = Math.sin((Math.min(1, sling.t / 0.5) * Math.PI) / 2);
    p.copy(sling.s0)
      .addScaledVector(sg.d, (sling.inc * 5 * k) / S.R)
      .normalize();
    sg.lit = Math.max(sg.lit, k);
    if (sling.t > 0.5) {
      sling.on = false;
      sg.cool = 2;
      vel.copy(sg.d).multiplyScalar(-sling.inc);
      pl.boost = 5;
      pl.vy = 3.2;
      if (pl.air <= 0) pl.air = 0.01;
      pl.stun = 1.0;
    }
  }
}

/** 고무줄의 줄: 걸려 있을 때는 나를 따라 늘어난다 */
export function slingsPose(g: Game) {
  const sling = g.rides.sling,
    dt = g.t.dt;
  for (const sg of g.slings) {
    if (sling.on && sling.s === sg) sg.mid.copy(g.pl.P);
    else sg.mid.lerp(sg.C, 1 - Math.exp(-14 * dt));
    placeBar(sg.ba, sg.A, sg.mid);
    placeBar(sg.bb, sg.B, sg.mid);
  }
}

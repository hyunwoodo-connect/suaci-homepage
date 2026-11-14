import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { GREY_TOY, S, WHITE } from "../state";
import type { HeadedSpot } from "../world/layout";
import type { GreyMesh } from "../world/materials";
import { grey } from "../world/materials";
import { cyl } from "../world/shapes";
import { clamp, from, heading, UP } from "../world/sphere";
import { featGround } from "../world/terrain";
import { placeBar } from "./bars";
import { padMat } from "./pads";

// 그네 구름 — 매달려 흔들리다 손을 떼는 순간 날아간다. 기둥 둘과 가로대 대신 둥근 아치 하나, 구름 방석에 두 줄

/** 그네 하나 */
export interface Swing extends HeadedSpot {
  pa: GreyMesh;
  pb: GreyMesh;
  top: GreyMesh;
  rope: GreyMesh;
  rope2: GreyMesh;
  seat: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  v: THREE.Vector3;
  d: THREE.Vector3;
  side: THREE.Vector3;
  A: THREE.Vector3;
  B: THREE.Vector3;
  /** 줄이 매달린 곳 */
  piv: THREE.Vector3;
  /** 방석이 있는 곳 */
  end: THREE.Vector3;
  g: number;
  cool: number;
  lit: number;
}

/** 그네에 매달려 있는 동안 */
export interface SwingRide {
  on: boolean;
  t: number;
  s: Swing | null;
  dir: number;
  /** 매달린 뒤 한 번이라도 끌었나(손을 떼면 날아간다) */
  touched: boolean;
  /** 칙 해서 뛰어내린다 */
  kick: boolean;
}

const tmp = new THREE.Vector3(),
  hy = new THREE.Vector3(),
  swingM = new THREE.Matrix4();

/** 그네를 만든다 */
export function createSwings(g: Game): Swing[] {
  const barGeo = g.barGeo;
  const archPts = Array.from(
    { length: 25 },
    (_, i) =>
      new THREE.Vector3(
        3.7 * Math.cos((i * Math.PI) / 24),
        10.5 * Math.sin((i * Math.PI) / 24) - 0.3,
        0,
      ),
  );
  const swingArch = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPts), 64, 0.55, 14);
  return g.L.swing.map((c) => {
    const pa = cyl(g.mats, 0.3, 10, 0xa9adac),
      pb = cyl(g.mats, 0.3, 10, 0xa9adac);
    pa.geometry = swingArch;
    pa.position.y = 0;
    pa.material.roughness = 0.2;
    pb.visible = false; // 기둥 둘과 가로대 대신 둥근 아치 하나
    const top = new THREE.Mesh(barGeo, grey(g.mats, 0xa9adac)),
      rope = new THREE.Mesh(barGeo, grey(g.mats, GREY_TOY)),
      rope2 = new THREE.Mesh(barGeo, rope.material);
    top.visible = false;
    const seat = new THREE.Mesh(g.pads.geo, padMat());
    seat.scale.set(1.9, 2.2, 1.9);
    g.scene.add(pa, pb, top, rope, rope2, seat); // 구름 방석에 두 줄
    return {
      ...c,
      pa,
      pb,
      top,
      rope,
      rope2,
      seat,
      v: new THREE.Vector3(),
      d: new THREE.Vector3(),
      side: new THREE.Vector3(),
      A: new THREE.Vector3(),
      B: new THREE.Vector3(),
      piv: new THREE.Vector3(),
      end: new THREE.Vector3(),
      g: 0,
      cool: 0,
      lit: 0,
    };
  });
}

/** 그네 자리: 아치를 세우고 줄이 매달릴 곳을 정한다 */
export function layoutSwings(g: Game, keep: THREE.Vector3[]) {
  for (const sw of g.swings) {
    sw.v.copy(from(sw.dist, sw.bear));
    sw.d.copy(heading(sw.v, sw.head));
    sw.side.crossVectors(sw.v, sw.d).normalize();
    sw.g = featGround(g, sw.v);
    keep.push(sw.v);
    const a = sw.v
        .clone()
        .addScaledVector(sw.side, 3.2 / S.R)
        .normalize(),
      b = sw.v
        .clone()
        .addScaledVector(sw.side, -3.2 / S.R)
        .normalize();
    sw.pa.position.copy(sw.v).multiplyScalar(S.R + sw.g);
    sw.pa.quaternion.setFromRotationMatrix(
      swingM.makeBasis(sw.side, sw.v, hy.crossVectors(sw.side, sw.v)),
    );
    sw.pb.position.copy(b).multiplyScalar(S.R + sw.g);
    sw.pb.quaternion.setFromUnitVectors(UP, b);
    sw.A.copy(a).multiplyScalar(S.R + sw.g + 10);
    sw.B.copy(b).multiplyScalar(S.R + sw.g + 10);
    sw.piv.copy(sw.v).multiplyScalar(S.R + sw.g + 10);
    placeBar(sw.top, sw.A, sw.B);
  }
}

/** 그네: 매달리면 점점 크게 흔들리고, 손을 떼거나 칙 하면 그 기세로 날아간다 */
export function swingsFrame(g: Game) {
  const { pl, t } = g,
    { p, vel } = pl,
    dt = t.dt,
    swing = g.rides.swing,
    TC = g.mats.toy,
    lime = g.mats.lime;
  for (const sw of g.swings) {
    if (sw.cool > 0) sw.cool -= dt;
    else if (!t.held && !swing.on && pl.air < 3 && p.angleTo(sw.v) * S.R < 3) {
      swing.on = true;
      swing.t = 0;
      swing.s = sw;
      swing.touched = false;
      swing.kick = false;
      swing.dir = vel.dot(sw.d) >= 0 ? 1 : -1;
      say(g, "그네 구름 — 흔들리다 손을 떼면 날아갑니다");
    }
    sw.lit = Math.max(0, sw.lit - dt * 0.8);
    sw.rope.material.color.copy(WHITE).lerp(lime, sw.lit);
    sw.pa.material.color.copy(TC.swing).lerp(lime, sw.lit * 0.6);
  }
  if (swing.on) {
    const sw = swing.s!;
    swing.t += dt;
    const A = Math.min(1.25, 0.45 + swing.t * 0.22),
      w = 2.1,
      L = 7.5;
    const th = A * Math.sin(w * swing.t) * swing.dir,
      thd = A * w * Math.cos(w * swing.t) * swing.dir;
    p.copy(sw.v)
      .addScaledVector(sw.d, (L * Math.sin(th)) / S.R)
      .normalize();
    pl.air = Math.max(
      0.01,
      sw.g + 10 - L * Math.cos(th) - Math.max(pl.gh, t.gNow - 0.4) - S.hover + 0.9,
    );
    pl.vy = 0;
    sw.lit = 1;
    if (t.m0 > 0.3) swing.touched = true;
    if ((swing.touched && t.m0 === 0 && swing.t > 0.6) || swing.kick || swing.t > 10) {
      swing.on = false;
      sw.cool = 2.5;
      vel.copy(sw.d).multiplyScalar(thd >= 0 ? 1 : -1);
      pl.boost = clamp(((Math.abs(thd) * L) / 7) * 1.5, 0.6, 4.5);
      pl.vy = Math.max(1.5, Math.abs(thd) * L * Math.sin(Math.abs(th)) * 0.9 + 2);
      pl.stun = 1.0;
    }
  }
}

/** 그네의 줄과 앉는 구름: 타고 있으면 나를 따라, 아니면 살랑 */
export function swingsPose(g: Game) {
  const { pl, time } = g,
    swing = g.rides.swing,
    dt = g.t.dt;
  for (const sw of g.swings) {
    if (swing.on && swing.s === sw) sw.end.copy(pl.P).addScaledVector(pl.p, -0.9);
    else {
      tmp
        .copy(sw.piv)
        .addScaledVector(sw.v, -7.5)
        .addScaledVector(sw.d, Math.sin(time * 1.3 + sw.dist) * 0.7);
      sw.end.lerp(tmp, 1 - Math.exp(-6 * dt));
    }
    tmp.copy(sw.piv).addScaledVector(sw.side, 1.5);
    placeBar(sw.rope, tmp, sw.end);
    tmp.copy(sw.piv).addScaledVector(sw.side, -1.5);
    placeBar(sw.rope2, tmp, sw.end);
    sw.seat.position.copy(sw.end).addScaledVector(sw.v, -0.5);
    sw.seat.quaternion.setFromUnitVectors(UP, sw.v);
  }
}

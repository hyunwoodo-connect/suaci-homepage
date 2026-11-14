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
  const archPts = Array.from({ length: 25 }, (_, i) => {
    const angle = (i * Math.PI) / 24;
    const x = 3.7 * Math.cos(angle);
    const y = 10.5 * Math.sin(angle) - 0.3;
    return new THREE.Vector3(x, y, 0);
  });
  const archCurve = new THREE.CatmullRomCurve3(archPts);
  const swingArch = new THREE.TubeGeometry(archCurve, 64, 0.55, 14);
  return g.L.swing.map((c) => {
    const pa = cyl(g.mats, 0.3, 10, 0xa9adac),
      pb = cyl(g.mats, 0.3, 10, 0xa9adac);
    pa.geometry = swingArch;
    pa.position.y = 0;
    pa.material.roughness = 0.2;
    pb.visible = false; // 기둥 둘과 가로대 대신 둥근 아치 하나
    const topMat = grey(g.mats, 0xa9adac);
    const top = new THREE.Mesh(barGeo, topMat);
    const ropeMat = grey(g.mats, GREY_TOY);
    const rope = new THREE.Mesh(barGeo, ropeMat);
    const rope2 = new THREE.Mesh(barGeo, rope.material);
    top.visible = false;
    const seatMat = padMat();
    const seat = new THREE.Mesh(g.pads.geo, seatMat);
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
    const spot = from(sw.dist, sw.bear);
    sw.v.copy(spot);
    const facing = heading(sw.v, sw.head);
    sw.d.copy(facing);
    sw.side.crossVectors(sw.v, sw.d).normalize();
    sw.g = featGround(g, sw.v);
    keep.push(sw.v);
    const legStep = 3.2 / S.R;
    const otherLegStep = -3.2 / S.R;
    const a = sw.v.clone().addScaledVector(sw.side, legStep).normalize(),
      b = sw.v.clone().addScaledVector(sw.side, otherLegStep).normalize();
    const groundR = S.R + sw.g;
    const barR = groundR + 10;
    sw.pa.position.copy(sw.v).multiplyScalar(groundR);
    const archNormal = hy.crossVectors(sw.side, sw.v);
    const archBasis = swingM.makeBasis(sw.side, sw.v, archNormal);
    sw.pa.quaternion.setFromRotationMatrix(archBasis);
    sw.pb.position.copy(b).multiplyScalar(groundR);
    sw.pb.quaternion.setFromUnitVectors(UP, b);
    sw.A.copy(a).multiplyScalar(barR);
    sw.B.copy(b).multiplyScalar(barR);
    sw.piv.copy(sw.v).multiplyScalar(barR);
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
    const fadedLit = sw.lit - dt * 0.8;
    sw.lit = Math.max(0, fadedLit);
    sw.rope.material.color.copy(WHITE).lerp(lime, sw.lit);
    const archGlow = sw.lit * 0.6;
    sw.pa.material.color.copy(TC.swing).lerp(lime, archGlow);
  }
  if (swing.on) {
    const sw = swing.s!;
    swing.t += dt;
    // 매달린 시간만큼 흔들림이 커진다(최대 1.25 라디안)
    const growingAmp = 0.45 + swing.t * 0.22;
    const amp = Math.min(1.25, growingAmp),
      omega = 2.1,
      ropeLen = 7.5;
    const phase = omega * swing.t;
    const angle = amp * Math.sin(phase) * swing.dir,
      angleVel = amp * omega * Math.cos(phase) * swing.dir;
    const seatShift = (ropeLen * Math.sin(angle)) / S.R;
    p.copy(sw.v).addScaledVector(sw.d, seatShift).normalize();
    const gNowFloor = t.gNow - 0.4;
    const floor = Math.max(pl.gh, gNowFloor);
    const seatAir = sw.g + 10 - ropeLen * Math.cos(angle) - floor - S.hover + 0.9;
    pl.air = Math.max(0.01, seatAir);
    pl.vy = 0;
    sw.lit = 1;
    if (t.m0 > 0.3) swing.touched = true;
    if ((swing.touched && t.m0 === 0 && swing.t > 0.6) || swing.kick || swing.t > 10) {
      swing.on = false;
      sw.cool = 2.5;
      const launchSign = angleVel >= 0 ? 1 : -1;
      vel.copy(sw.d).multiplyScalar(launchSign);
      const seatSpeed = Math.abs(angleVel) * ropeLen;
      const launchBoost = (seatSpeed / 7) * 1.5;
      pl.boost = clamp(launchBoost, 0.6, 4.5);
      const absAngle = Math.abs(angle);
      const launchVy = seatSpeed * Math.sin(absAngle) * 0.9 + 2;
      pl.vy = Math.max(1.5, launchVy);
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
      const swayPhase = time * 1.3 + sw.dist;
      const sway = Math.sin(swayPhase) * 0.7;
      tmp.copy(sw.piv).addScaledVector(sw.v, -7.5).addScaledVector(sw.d, sway);
      const settleRate = -6 * dt;
      const settle = 1 - Math.exp(settleRate);
      sw.end.lerp(tmp, settle);
    }
    tmp.copy(sw.piv).addScaledVector(sw.side, 1.5);
    placeBar(sw.rope, tmp, sw.end);
    tmp.copy(sw.piv).addScaledVector(sw.side, -1.5);
    placeBar(sw.rope2, tmp, sw.end);
    sw.seat.position.copy(sw.end).addScaledVector(sw.v, -0.5);
    sw.seat.quaternion.setFromUnitVectors(UP, sw.v);
  }
}

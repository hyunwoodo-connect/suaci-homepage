import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Tappable } from "../core/tap";
import type { GreyMesh } from "../look";
import type { Holder } from "../player/player";
import type { Services } from "../services";
import { GREY_TOY, S, WHITE } from "../settings";
import type { HeadedSpot } from "../world/layout";
import { clamp, from, heading, UP } from "../world/sphere";
import { placeBar } from "./bars";

// 그네 구름 — 매달려 흔들리다 손을 떼는 순간 날아간다. 기둥 둘과 가로대 대신 둥근 아치 하나, 구름 방석에 두 줄

/** 그네 하나: 아치(pa)·줄 둘·앉는 구름, 줄이 매달린 곳(piv)·방석이 있는 곳(end) */
export interface Swing extends HeadedSpot {
  pa: GreyMesh;
  rope: GreyMesh;
  rope2: GreyMesh;
  seat: THREE.Mesh;
  v: THREE.Vector3;
  d: THREE.Vector3;
  side: THREE.Vector3;
  piv: THREE.Vector3;
  end: THREE.Vector3;
  g: number;
  cool: number;
  lit: number;
}

/** 매달린 그네: 흔드는 쪽(dir), 한 번이라도 끌었나(touched — 손을 떼면 날아간다), 칙으로 뛰어내리기(kick) */
interface SwingRide {
  sw: Swing;
  t: number;
  dir: number;
  touched: boolean;
  kick: boolean;
}

const tmp = new THREE.Vector3(),
  hy = new THREE.Vector3(),
  swingM = new THREE.Matrix4(),
  launch = new THREE.Vector3();

/** 그네 전체(나를 붙잡는다) */
export class Swings implements Thing, Holder, Tappable {
  readonly list: Swing[];
  /** 붙잡혀 있어도 중력은 그대로 받는다(놀이기구가 높이를 직접 정한다) */
  readonly freezesGravity = false;
  /** 줄과 앉는 구름: 타고 있으면 나를 따라, 아니면 살랑(내 자리가 정해진 뒤) */
  readonly pose: Thing;
  private ride: SwingRide | null = null;
  private readonly archGeo: THREE.TubeGeometry;
  private readonly barGeo = new THREE.CylinderGeometry(0.22, 0.22, 1, 10);
  private readonly seatGeo = padCloudGeometry();
  private readonly seatMat = new THREE.MeshStandardMaterial({
    color: 0xfafbfb,
    roughness: 0.32,
    metalness: 0,
    emissive: 0xffffff,
    emissiveIntensity: 0.12,
  });
  private readonly matList: THREE.Material[] = [];

  constructor(private readonly s: Services) {
    const archPts = Array.from({ length: 25 }, (_, i) => {
      const angle = (i * Math.PI) / 24;
      const x = 3.7 * Math.cos(angle);
      const y = 10.5 * Math.sin(angle) - 0.3;
      return new THREE.Vector3(x, y, 0);
    });
    const archCurve = new THREE.CatmullRomCurve3(archPts);
    this.archGeo = new THREE.TubeGeometry(archCurve, 64, 0.55, 14);
    this.list = s.layout.swing.map((c) => {
      // 그네마다 매달린 것만 라임으로 물들어 아치·줄 재질은 따로
      const archMat = s.mats.grey(0xa9adac),
        ropeMat = s.mats.grey(GREY_TOY);
      this.matList.push(archMat, ropeMat);
      const arch = new THREE.Mesh(this.archGeo, archMat);
      const rope = new THREE.Mesh(this.barGeo, ropeMat),
        rope2 = new THREE.Mesh(this.barGeo, ropeMat);
      const seat = new THREE.Mesh(this.seatGeo, this.seatMat);
      seat.scale.set(1.9, 2.2, 1.9);
      s.scene.add(arch, rope, rope2, seat); // 구름 방석에 두 줄
      return {
        ...c,
        pa: arch,
        rope,
        rope2,
        seat,
        v: new THREE.Vector3(),
        d: new THREE.Vector3(),
        side: new THREE.Vector3(),
        piv: new THREE.Vector3(),
        end: new THREE.Vector3(),
        g: 0,
        cool: 0,
        lit: 0,
      };
    });
    this.pose = { update: (f) => this.updatePose(f), dispose: () => {} };
  }

  /** 자리: 아치를 세우고 줄이 매달릴 곳을 정한다 */
  layout(keep: THREE.Vector3[]) {
    const { terrain, culler } = this.s;
    for (const sw of this.list) {
      const spot = from(sw.dist, sw.bear);
      sw.v.copy(spot);
      const facing = heading(sw.v, sw.head);
      sw.d.copy(facing);
      sw.side.crossVectors(sw.v, sw.d).normalize();
      sw.g = terrain.featGround(sw.v);
      keep.push(sw.v);
      const groundR = S.R + sw.g;
      const barR = groundR + 10;
      sw.pa.position.copy(sw.v).multiplyScalar(groundR);
      const archNormal = hy.crossVectors(sw.side, sw.v);
      const archBasis = swingM.makeBasis(sw.side, sw.v, archNormal);
      sw.pa.quaternion.setFromRotationMatrix(archBasis);
      sw.piv.copy(sw.v).multiplyScalar(barR);
      for (const m of [sw.pa, sw.rope, sw.rope2, sw.seat]) culler.track(m, sw.v);
    }
  }

  /** 자리 차지: 몸 둘레, 그리고 날아가는 길(비행 통로) */
  claim() {
    for (const sw of this.list) {
      this.s.occ.fill(sw.v, 5);
      this.s.occ.addCorridor(sw.v, 8);
    }
  }

  /** 매달려 있으면 칙 해서 뛰어내린다 */
  onTap() {
    if (this.ride) this.ride.kick = true;
  }

  /** 매달리면 점점 크게 흔들리고, 손을 떼거나 칙 하면 그 기세로 날아간다 */
  update(f: Frame) {
    const { player, mats, hud } = this.s,
      dt = f.dt,
      p = player.p;
    for (const sw of this.list) {
      if (sw.cool > 0) sw.cool -= dt;
      else if (!player.held && !this.ride && player.air < 3 && p.angleTo(sw.v) * S.R < 3) {
        if (player.grab(this)) {
          const dir = player.vel.dot(sw.d) >= 0 ? 1 : -1;
          this.ride = { sw, t: 0, dir, touched: false, kick: false };
          hud.say("그네 구름 — 흔들리다 손을 떼면 날아갑니다");
        }
      }
      const fadedLit = sw.lit - dt * 0.8;
      sw.lit = Math.max(0, fadedLit);
      sw.rope.material.color.copy(WHITE).lerp(mats.lime, sw.lit);
      const archGlow = sw.lit * 0.6;
      sw.pa.material.color.copy(mats.toy.swing).lerp(mats.lime, archGlow);
    }
    const ride = this.ride;
    const body = player.bodyFor(this);
    if (!ride || !body) return;
    const sw = ride.sw;
    ride.t += dt;
    // 매달린 시간만큼 흔들림이 커진다(최대 1.25 라디안)
    const growingAmp = 0.45 + ride.t * 0.22;
    const amp = Math.min(1.25, growingAmp),
      omega = 2.1,
      ropeLen = 7.5;
    const phase = omega * ride.t;
    const angle = amp * Math.sin(phase) * ride.dir,
      angleVel = amp * omega * Math.cos(phase) * ride.dir;
    const seatShift = (ropeLen * Math.sin(angle)) / S.R;
    body.p.copy(sw.v).addScaledVector(sw.d, seatShift).normalize();
    const seatAir = sw.g + 10 - ropeLen * Math.cos(angle) - player.floor - S.hover + 0.9;
    body.air = Math.max(0.01, seatAir);
    body.vy = 0;
    sw.lit = 1;
    if (player.m0 > 0.3) ride.touched = true;
    const letGo = ride.touched && player.m0 === 0 && ride.t > 0.6;
    if (letGo || ride.kick || ride.t > 10) {
      this.ride = null;
      sw.cool = 2.5;
      const launchSign = angleVel >= 0 ? 1 : -1;
      launch.copy(sw.d).multiplyScalar(launchSign);
      const seatSpeed = Math.abs(angleVel) * ropeLen;
      const launchBoost = (seatSpeed / 7) * 1.5;
      const boost = clamp(launchBoost, 0.6, 4.5);
      const absAngle = Math.abs(angle);
      const launchVy = seatSpeed * Math.sin(absAngle) * 0.9 + 2;
      const vy = Math.max(1.5, launchVy);
      player.release(this, { vel: launch, boost, vy, stun: 1.0 });
    }
  }

  /** 치운다 */
  dispose() {
    for (const sw of this.list)
      for (const m of [sw.pa, sw.rope, sw.rope2, sw.seat]) m.removeFromParent();
    this.archGeo.dispose();
    this.barGeo.dispose();
    this.seatGeo.dispose();
    this.seatMat.dispose();
    for (const m of this.matList) m.dispose();
  }

  // 줄과 앉는 구름을 놓는다. 끝(end)이 정해진 뒤 그 둘레를 빛낸다
  private updatePose(f: Frame) {
    const { player, fx } = this.s;
    for (const sw of this.list) {
      if (this.ride && this.ride.sw === sw) sw.end.copy(player.P).addScaledVector(player.p, -0.9);
      else {
        const swayPhase = f.time * 1.3 + sw.dist;
        const sway = Math.sin(swayPhase) * 0.7;
        tmp.copy(sw.piv).addScaledVector(sw.v, -7.5).addScaledVector(sw.d, sway);
        const settle = ease(6, f.dt);
        sw.end.lerp(tmp, settle);
      }
      tmp.copy(sw.piv).addScaledVector(sw.side, 1.5);
      placeBar(sw.rope, tmp, sw.end);
      tmp.copy(sw.piv).addScaledVector(sw.side, -1.5);
      placeBar(sw.rope2, tmp, sw.end);
      sw.seat.position.copy(sw.end).addScaledVector(sw.v, -0.5);
      sw.seat.quaternion.setFromUnitVectors(UP, sw.v);
      if (sw.lit > 0) {
        const alpha = sw.lit * 0.7;
        fx.glow(sw.end, 4, alpha);
      }
    }
  }
}

/* ─── 내부 ─────────────────────────── */

// 몽글몽글한 구름 방석(통통 구름과 같은 모양): 가운데 큰 덩이 + 둘레 일곱 덩이
function padCloudGeometry(): THREE.BufferGeometry {
  const core = new THREE.SphereGeometry(0.7, 20, 14);
  core.scale(1, 0.95, 1);
  core.translate(0, 0.28, 0);
  const parts: THREE.BufferGeometry[] = [core];
  for (let i = 0; i < 7; i++) {
    const a = (i * Math.PI * 2) / 7,
      r = 0.4 + (i % 2) * 0.07,
      pg = new THREE.SphereGeometry(r, 16, 12);
    const px = Math.cos(a) * 0.6,
      py = 0.02 + (i % 3) * 0.05,
      pz = Math.sin(a) * 0.6;
    pg.translate(px, py, pz);
    parts.push(pg);
  }
  const merged = mergeGeometries(parts);
  for (const pg of parts) pg.dispose();
  return merged;
}

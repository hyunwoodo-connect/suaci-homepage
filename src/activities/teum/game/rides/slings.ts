import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { GreyMesh } from "../look";
import type { Holder } from "../player/player";
import type { Services } from "../services";
import { GREY_TOY, S } from "../settings";
import type { HeadedSpot } from "../world/layout";
import { along, from, heading, UP } from "../world/sphere";
import { placeBar } from "./bars";

// 고무줄 — 두 기둥 사이 줄에 부딪히면 쭉 늘어났다가 반대로 튕겨 날아간다

/** 고무줄 하나: 기둥 둘(pa·pb)과 줄 둘(ba·bb), 줄 끝(A·B)·가운데(C)·지금 당겨진 자리(mid) */
export interface Sling extends HeadedSpot {
  pa: THREE.Mesh;
  pb: THREE.Mesh;
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

/** 걸려 있는 고무줄: 들어온 방향(inc: +1 앞, -1 뒤)과 걸린 자리(s0) */
interface SlingRide {
  sg: Sling;
  t: number;
  inc: number;
  s0: THREE.Vector3;
}

const tmp = new THREE.Vector3(),
  pa = new THREE.Vector3(),
  pb = new THREE.Vector3(),
  launch = new THREE.Vector3();

/** 고무줄 전체(나를 붙잡는다) */
export class Slings implements Thing, Holder {
  readonly list: Sling[];
  /** 붙잡혀 있어도 중력은 그대로 받는다(놀이기구가 높이를 직접 정한다) */
  readonly freezesGravity = false;
  /** 줄은 내 몸을 따라 늘어난다(내 자리가 정해진 뒤) */
  readonly pose: Thing;
  private ride: SlingRide | null = null;
  private readonly s0 = new THREE.Vector3();
  private readonly barGeo = new THREE.CylinderGeometry(0.22, 0.22, 1, 10);
  private readonly poleGeo = new THREE.CapsuleGeometry(0.5, 3.4, 6, 14).translate(0, 2.2, 0);
  private readonly poleMat: THREE.MeshStandardMaterial;
  private readonly bandMats: THREE.MeshStandardMaterial[] = [];

  constructor(private readonly s: Services) {
    this.poleMat = s.mats.pole();
    this.list = s.layout.sling.map((c) => {
      const poleA = new THREE.Mesh(this.poleGeo, this.poleMat),
        poleB = new THREE.Mesh(this.poleGeo, this.poleMat);
      // 두 줄은 늘 같은 색이라 재질 하나를 같이 쓴다(고무줄마다는 따로 — 걸린 것만 라임)
      const bandMat = s.mats.grey(GREY_TOY);
      this.bandMats.push(bandMat);
      const ba = new THREE.Mesh(this.barGeo, bandMat),
        bb = new THREE.Mesh(this.barGeo, bandMat);
      s.scene.add(poleA, poleB, ba, bb);
      return {
        ...c,
        pa: poleA,
        pb: poleB,
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
    this.pose = { update: (f) => this.updatePose(f), dispose: () => {} };
  }

  /** 자리: 기둥 둘을 옆으로 벌려 세운다 */
  layout(keep: THREE.Vector3[]) {
    const { terrain, culler } = this.s;
    for (const sg of this.list) {
      const spot = from(sg.dist, sg.bear);
      sg.v.copy(spot);
      const facing = heading(sg.v, sg.head);
      sg.d.copy(facing);
      sg.side.crossVectors(sg.v, sg.d).normalize();
      keep.push(sg.v);
      const poleStep = 5 / S.R;
      const otherPoleStep = -5 / S.R;
      const gr = terrain.featGround(sg.v);
      pa.copy(sg.v).addScaledVector(sg.side, poleStep).normalize();
      pb.copy(sg.v).addScaledVector(sg.side, otherPoleStep).normalize();
      const groundR = S.R + gr;
      const bandR = groundR + 2.4;
      sg.pa.position.copy(pa).multiplyScalar(groundR);
      sg.pa.quaternion.setFromUnitVectors(UP, pa);
      sg.pb.position.copy(pb).multiplyScalar(groundR);
      sg.pb.quaternion.setFromUnitVectors(UP, pb);
      sg.A.copy(pa).multiplyScalar(bandR);
      sg.B.copy(pb).multiplyScalar(bandR);
      sg.C.copy(sg.v).multiplyScalar(bandR);
      sg.mid.copy(sg.C);
      for (const m of [sg.pa, sg.pb, sg.ba, sg.bb]) culler.track(m, sg.v);
    }
  }

  /** 자리 차지: 몸 둘레, 그리고 튕겨 보내는 길(뒤쪽, 비행 통로) */
  claim() {
    const occ = this.s.occ;
    for (const sg of this.list) {
      occ.fill(sg.v, 5);
      for (let k = 0; k <= 5; k++) {
        const behind = -k * 7,
          point = along(sg.v, sg.d, behind);
        occ.addCorridor(point, 10);
      }
    }
  }

  /** 줄에 닿으면 쭉 당겨졌다가 반대로 튕긴다 */
  update(f: Frame) {
    const { player, mats, hud } = this.s,
      dt = f.dt,
      p = player.p;
    for (const sg of this.list) {
      if (sg.cool > 0) sg.cool -= dt;
      else if (!player.held && !this.ride && player.air < 4 && player.tot > 0.3) {
        tmp.copy(p).sub(sg.v);
        const alongD = tmp.dot(sg.d) * S.R,
          lat = tmp.dot(sg.side) * S.R;
        if (Math.abs(alongD) < 1.3 && Math.abs(lat) < 4.6 && player.grab(this)) {
          const inc = player.vel.dot(sg.d) >= 0 ? 1 : -1;
          this.s0.copy(p);
          this.ride = { sg, t: 0, inc, s0: this.s0 };
          hud.say("고무줄 — 쭉 늘어났다가 튕겨 날아갑니다");
        }
      }
      const fadedLit = sg.lit - dt * 0.8;
      sg.lit = Math.max(0, fadedLit);
      sg.ba.material.color.copy(mats.toy.sling).lerp(mats.lime, sg.lit);
    }
    const ride = this.ride;
    const body = player.bodyFor(this);
    if (!ride || !body) return;
    const sg = ride.sg;
    ride.t += dt;
    // 0.5초 동안 사인 곡선으로 줄을 끝까지(5) 당긴다
    const pullTime = ride.t / 0.5;
    const pull = Math.min(1, pullTime);
    const pullAngle = (pull * Math.PI) / 2;
    const k = Math.sin(pullAngle);
    const stretch = (ride.inc * 5 * k) / S.R;
    body.p.copy(ride.s0).addScaledVector(sg.d, stretch).normalize();
    sg.lit = Math.max(sg.lit, k);
    if (ride.t > 0.5) {
      this.ride = null;
      sg.cool = 2;
      const back = -ride.inc;
      launch.copy(sg.d).multiplyScalar(back);
      player.release(this, { vel: launch, boost: 5, stun: 1.0 });
      player.bounce(3.2);
    }
  }

  /** 치운다 */
  dispose() {
    for (const sg of this.list) for (const m of [sg.pa, sg.pb, sg.ba, sg.bb]) m.removeFromParent();
    this.barGeo.dispose();
    this.poleGeo.dispose();
    this.poleMat.dispose();
    for (const m of this.bandMats) m.dispose();
  }

  // 줄: 걸려 있을 때는 나를 따라 늘어나고, 아니면 가운데로 탁 돌아온다
  private updatePose(f: Frame) {
    const { player, fx } = this.s;
    for (const sg of this.list) {
      if (this.ride && this.ride.sg === sg) sg.mid.copy(player.P);
      else {
        const snap = ease(14, f.dt);
        sg.mid.lerp(sg.C, snap);
      }
      placeBar(sg.ba, sg.A, sg.mid);
      placeBar(sg.bb, sg.B, sg.mid);
      if (sg.lit > 0) fx.glow(sg.mid, 6, sg.lit);
    }
  }
}

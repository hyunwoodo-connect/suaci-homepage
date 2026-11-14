import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Random } from "../core/random";
import type { Holder } from "../player/player";
import type { Services } from "../services";
import { GREY_TOY, S } from "../settings";
import { from, UP } from "../world/sphere";

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

/** 타 있는 로켓과 탄 뒤 시간 */
interface RocketRide {
  o: Rocket;
  t: number;
}

const ps = new THREE.Vector3();

/** 로켓 풍선 전체(나를 붙잡는다) */
export class Rockets implements Thing, Holder {
  readonly list: Rocket[];
  /** 붙잡혀 있어도 중력은 그대로 받는다(놀이기구가 높이를 직접 정한다) */
  readonly freezesGravity = false;
  /** 로켓 모양: 타고 있을 때는 내 발밑에 붙어 같이 올라간다(내 자리가 정해진 뒤) */
  readonly pose: Thing;
  private ride: RocketRide | null = null;
  private readonly rng: Random;
  private readonly bodyGeo = new THREE.CapsuleGeometry(1.15, 2.4, 8, 18);
  private readonly finGeo = new THREE.SphereGeometry(0.75, 12, 10);
  private readonly winGeo = new THREE.SphereGeometry(0.5, 14, 10);
  /** 창은 반응하지 않는 흰색(기둥 줄의 심과 같은 색) */
  private readonly winMat: THREE.MeshStandardMaterial;

  constructor(private readonly s: Services) {
    this.rng = s.rng.fork("rockets");
    this.winMat = s.mats.grey(0xffffff);
    this.list = s.layout.rocket.map(({ dist, bear }) => {
      // 로켓마다 탄 것만 라임으로 물들어 몸 재질은 따로
      const gr = new THREE.Group(),
        mat = s.mats.grey(GREY_TOY);
      const body = new THREE.Mesh(this.bodyGeo, mat);
      body.position.y = 2.9;
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI * 2) / 3;
        const fin = new THREE.Mesh(this.finGeo, mat);
        fin.scale.set(1, 1.5, 0.45);
        const finX = Math.cos(a) * 1.25;
        const finZ = Math.sin(a) * 1.25;
        fin.position.set(finX, 1.1, finZ);
        fin.rotation.y = -a;
        gr.add(fin);
      }
      const win = new THREE.Mesh(this.winGeo, this.winMat);
      win.position.set(0, 3.6, 1.0);
      gr.add(body, win);
      s.scene.add(gr);
      return { g: gr, mat, dist, bear, v: new THREE.Vector3(), gnd: 0, cool: 0 };
    });
    this.pose = { update: (f) => this.updatePose(f), dispose: () => {} };
  }

  /** 자리 */
  layout(keep: THREE.Vector3[]) {
    const { terrain, culler } = this.s;
    for (const o of this.list) {
      const spot = from(o.dist, o.bear);
      o.v.copy(spot);
      o.gnd = terrain.featGround(o.v);
      keep.push(o.v);
      const groundR = S.R + o.gnd;
      o.g.position.copy(o.v).multiplyScalar(groundR);
      o.g.quaternion.setFromUnitVectors(UP, o.v);
      culler.track(o.g, o.v);
    }
  }

  /** 자리 차지: 몸 둘레, 그리고 솟구치는 길(비행 통로) */
  claim() {
    for (const o of this.list) {
      this.s.occ.fill(o.v, 5);
      this.s.occ.addCorridor(o.v, 8);
    }
  }

  /** 올라타면 떨다가 솟구친다 */
  update(f: Frame) {
    const { player, mats, fx, hud } = this.s,
      dt = f.dt,
      p = player.p;
    for (const o of this.list) {
      if (o.cool > 0) o.cool -= dt;
      else if (!player.held && !this.ride && player.air < 3 && p.angleTo(o.v) * S.R < 3.2) {
        if (player.grab(this)) {
          this.ride = { o, t: 0 };
          hud.say("로켓 풍선 — 하늘 끝까지 솟구칩니다");
        }
      }
      const isRiding = this.ride !== null && this.ride.o === o;
      const glow = isRiding ? 1 : 0;
      o.mat.color.copy(mats.toy.rocket).lerp(mats.lime, glow);
    }
    const ride = this.ride;
    const body = player.bodyFor(this);
    if (!ride || !body) return;
    const o = ride.o;
    ride.t += dt;
    const snap = ease(12, dt);
    body.p.lerp(o.v, snap).normalize();
    if (ride.t < 0.9) {
      // 덜덜 떠는 동안
      const hoverEase = ease(10, dt);
      body.air += (3.4 - body.air) * hoverEase;
      body.vy = 0;
    } else {
      body.vy = 24;
      if (this.rng.next() < 0.6) {
        ps.copy(player.P).addScaledVector(p, -3);
        fx.burst(ps, 1, 4);
      }
    }
    if (ride.t > 3.3) {
      this.ride = null;
      o.cool = 6;
      player.release(this, { vy: 10, boost: 0.6 });
    }
  }

  /** 치운다 */
  dispose() {
    for (const o of this.list) {
      o.g.removeFromParent();
      o.mat.dispose();
    }
    this.bodyGeo.dispose();
    this.finGeo.dispose();
    this.winGeo.dispose();
    this.winMat.dispose();
  }

  // 타고 있을 때는 발밑에 붙어 같이 오르고(떠는 동안은 흔들리며), 아니면 제자리. 쉬는 동안(cool)은 숨는다
  private updatePose(f: Frame) {
    const player = this.s.player,
      { p, h, P } = player;
    for (const o of this.list) {
      const mine = this.ride !== null && this.ride.o === o;
      o.g.visible = mine || o.cool <= 0;
      if (mine) {
        o.g.position.copy(P).addScaledVector(p, -4.6);
        if (this.ride!.t < 0.9) {
          const shakePhase = f.time * 70;
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
}

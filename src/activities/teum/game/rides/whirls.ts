import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Holder } from "../player/player";
import type { Services } from "../services";
import { S } from "../settings";
import type { LayoutWhirl } from "../world/layout";
import { from, step, UP } from "../world/sphere";
import type { Streams } from "./streams";

// 회오리 — 닿으면 빙글빙글 빨려 올라갔다가 튕겨 나간다

/** 회오리 하나 */
export interface Whirl extends LayoutWhirl {
  g: THREE.Group;
  spin: THREE.Group;
  v: THREE.Vector3;
  cool: number;
}

/** 고리 일곱 겹(회오리마다 같은 모양) */
const RINGS = 7;

const tmp = new THREE.Vector3();

/** 회오리 전체(나를 붙잡는다 — 안에서는 화면이 같이 돌지 않게 카메라가 들어올 때의 방향을 지킨다) */
export class Whirls implements Thing, Holder {
  readonly list: Whirl[];
  readonly cameraMode = "spin";
  /** 실려 있는 회오리와 실린 뒤 시간 */
  private ride: { w: Whirl; t: number } | null = null;
  private readonly geos: THREE.TorusGeometry[] = [];
  private readonly mat: THREE.MeshStandardMaterial;

  constructor(private readonly s: Services) {
    for (let i = 0; i < RINGS; i++) {
      const ringRadius = 1.4 + i * 0.85;
      const ringGeo = new THREE.TorusGeometry(ringRadius, 0.3, 10, 36);
      this.geos.push(ringGeo);
    }
    // 회오리 고리는 반응하지 않아 톤의 노랑 하나로 같이 쓴다
    this.mat = s.mats.grey(0xffffff);
    this.mat.color.copy(s.mats.toy.whirl);
    this.list = s.layout.whirl.map((w) => {
      const gr = new THREE.Group(),
        spin = new THREE.Group();
      gr.add(spin);
      for (let i = 0; i < RINGS; i++) {
        const t = new THREE.Mesh(this.geos[i], this.mat);
        t.rotation.x = Math.PI / 2;
        t.position.y = 1.2 + i * 2.5;
        spin.add(t);
      }
      spin.scale.set(1.7, 2.2, 1.7);
      s.scene.add(gr);
      return { ...w, g: gr, spin, v: new THREE.Vector3(), cool: 0 };
    });
  }

  /** 자리: 바람길 끝 조금 앞이거나 제 자리 */
  layout(keep: THREE.Vector3[], streams: Streams) {
    for (const w of this.list) {
      let spot: THREE.Vector3;
      if (w.afterStream != null) {
        const stream = streams.list[w.afterStream];
        [spot] = step(stream.endV, stream.endD, 10, 0);
      } else spot = from(w.dist!, w.bear!);
      w.v.copy(spot);
      keep.push(w.v);
      const radius = S.R + this.s.terrain.featGround(w.v);
      w.g.position.copy(w.v).multiplyScalar(radius);
      w.g.quaternion.setFromUnitVectors(UP, w.v);
      this.s.culler.track(w.g, w.v);
    }
  }

  /** 자리 차지: 회오리 둘레, 그리고 튕겨 보내는 길(비행 통로) */
  claim() {
    for (const w of this.list) {
      this.s.occ.fill(w.v, 5);
      this.s.occ.addCorridor(w.v, 8);
    }
  }

  /** 닿으면 빨려 들어가 돌며 솟는다 */
  update(f: Frame) {
    const { player, camera, hud } = this.s,
      dt = f.dt,
      p = player.p;
    for (const w of this.list) {
      const riding = this.ride !== null && this.ride.w === w;
      const spinRate = riding ? 7 : 1.6;
      w.spin.rotation.y += dt * spinRate;
      if (w.cool > 0) w.cool -= dt;
      else if (!player.held && player.air < 12 && p.angleTo(w.v) * S.R < 5) {
        // 같은 프레임에 둘에 닿으면 뒤의 것이 이긴다(먼저 붙잡은 것을 이어받는다)
        const body = this.ride ? player.bodyFor(this) : player.grab(this);
        if (body) {
          this.ride = { w, t: 0 };
          camera.lockHeading(body.h);
          hud.say("회오리 — 빙글빙글 빨려 올라갑니다");
        }
      }
    }
    const ride = this.ride;
    const body = player.bodyFor(this);
    if (ride && body) {
      const w = ride.w,
        bp = body.p;
      ride.t += dt;
      if (bp.angleTo(w.v) * S.R < 3.2) {
        const pUp = bp.dot(w.v);
        tmp.copy(bp).addScaledVector(w.v, -pUp);
        if (tmp.lengthSq() < 1e-10) tmp.copy(body.h);
        tmp.normalize();
        const rimAngle = 3.6 / S.R;
        bp.copy(w.v).addScaledVector(tmp, rimAngle).normalize();
      }
      const turn = 2.5 * dt;
      bp.applyAxisAngle(w.v, turn).normalize();
      body.h.crossVectors(w.v, bp);
      const hUp = body.h.dot(bp);
      body.h.addScaledVector(bp, -hUp).normalize();
      body.vel.copy(body.h);
      body.vy = 6.2;
      if (body.air <= 0) body.air = 0.01;
      if (ride.t > 3.2) {
        this.ride = null;
        w.cool = 5;
        player.release(this, { boost: 1.6, vy: 3.5 });
      }
    }
    // 회오리·깔때기에 실린 정도: 지금 붙잡은 것이 화면을 지키는 놀이기구인지로 정한다(깔때기는 아직 이번 프레임 전)
    const spinning = player.holderCamera === "spin";
    const spinTarget = spinning ? 1 : 0;
    const blendRate = spinning ? 5 : 1.5;
    const blendPull = ease(blendRate, dt);
    camera.easeSpin(spinTarget, blendPull);
  }

  /** 치운다 */
  dispose() {
    for (const w of this.list) w.g.removeFromParent();
    for (const g of this.geos) g.dispose();
    this.mat.dispose();
  }
}

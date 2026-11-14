import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Holder } from "../player/player";
import type { Services } from "../services";
import { S } from "../settings";
import { clamp, fromInto, START } from "../world/sphere";
import type { HasHeights, Height } from "../world/tall";

// 고래 등 — 출발 마을 둘레를 천천히 돈다. 높이 떠 있을 때 고래가 지나가면 올라탄다(고리 줄이나 통통 구름으로 올라가야 닿는다).
// 높이는 도는 길 아래 가장 높은 것 꼭대기 + 12m, 도는 반지름은 길 아래가 가장 낮은 곳(오너 확인 — 올려다봐야 보이는 높이였을 때 사라진 것처럼 보였다)

const bx = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  ahead = new THREE.Vector3();

/** 고래(나를 등에 태운다) */
export class Whale implements Thing, Holder {
  /** 등에 타 있는 동안 카메라가 뒤로 물러나고, 중력이 멈춘다 */
  readonly cameraMode = "ride";
  readonly freezesGravity = true;
  /** 자리(그룹)와 모양(도형 또는 에셋)을 나눈다 */
  readonly g = new THREE.Group();
  readonly prim: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  /** 지금 자리와 나아가는 쪽 */
  readonly v = new THREE.Vector3();
  readonly f = new THREE.Vector3();
  /** 떠 있는 높이 — 풍경을 다 놓은 뒤 choosePath 가 정한다 */
  WH = 150;
  /** 도는 반지름 */
  WR = 70;
  /** 등에 탔을 때 내 몸이 떠 있는 높이 — 고래 모델이 오면 그 등 높이로 */
  rideH = 5.6;
  /** 고래가 출렁이는 높이(등에 탄 몸도 같이) */
  wbob = 0;
  /** 출발점 둘레를 도는 것(프레임 처음, 내가 움직이기 전) */
  readonly mover: Thing;
  private on = false;
  private t = 0;
  private cool = 0;

  constructor(private readonly s: Services) {
    const primGeo = new THREE.SphereGeometry(1, 28, 18);
    const primMat = new THREE.MeshBasicMaterial({ color: 0xd7dad9 });
    this.prim = new THREE.Mesh(primGeo, primMat);
    this.prim.scale.set(16, 5, 6.5);
    this.g.add(this.prim);
    s.scene.add(this.g);
    this.mover = { update: (f) => this.move(f), dispose: () => {} };
  }

  /**
   * 도는 길을 정한다(나무·꽃·조형물·랜드마크를 다 놓은 뒤).
   * 도는 반지름을 바꿔 가며 길 아래(±36m 띠)가 가장 낮은 곳을 고르고, 그 띠에서 가장 높은 것 꼭대기 + 12m 로 띄운다
   */
  choosePath(sources: readonly HasHeights[]) {
    const all: Height[] = [];
    for (const src of sources) src.pushHeights(all);
    const ds = all.map(([v, H]) => [v.angleTo(START) * S.R, H]);
    let bestR = 70,
      bestTop = 1e9;
    for (const r of [50, 70, 90, 110, 130, 150, 170]) {
      let top = 30;
      for (const [d, H] of ds) {
        const off = d - r;
        const band = Math.abs(off);
        if (band < 36) top = Math.max(top, H);
      }
      if (top < bestTop - 1) {
        bestTop = top;
        bestR = r;
      }
    }
    this.WR = bestR;
    const above = bestTop + 12;
    this.WH = clamp(above, 48, 112);
  }

  /** 고래 모델: 머리가 +z 라서 나아가는 방향(+x)으로 돌려 놓는다. 오면 도형 고래를 숨기고 등 높이를 모델 키에 맞춘다 */
  fitModels() {
    const models = this.s.models;
    if (!models.has("whale")) return;
    const W = models.fit("whale", 64, "z");
    W.rotation.y = Math.PI / 2;
    this.g.add(W);
    // 등 높이를 맞추지 않으면 등에 타도 고래 몸속에 있다
    const backH = W.userData.hh + 0.9;
    models.when("whale", () => {
      this.rideH = backH;
    });
    models.swapWhenReady("whale", [this.prim]);
  }

  /** 높이 떠서 가까이 가면 올라타고, 끌면 내린다 */
  update(f: Frame) {
    const { player, hud, camera } = this.s,
      dt = f.dt;
    if (this.cool > 0) this.cool -= dt;
    const altOffset = player.alt - (this.WH + 6);
    if (
      !this.on &&
      this.cool <= 0 &&
      player.air > 3 &&
      player.p.angleTo(this.v) * S.R < 26 &&
      Math.abs(altOffset) < 15 &&
      player.grab(this)
    ) {
      this.on = true;
      this.t = 0;
      hud.say("고래 등 — 끌면 내립니다");
    }
    const body = player.bodyFor(this);
    if (this.on && body) {
      this.t += dt;
      const k = ease(6, dt);
      body.p.lerp(this.v, k).normalize();
      body.h.lerp(this.f, k);
      const hUp = body.h.dot(body.p);
      body.h.addScaledVector(body.p, -hUp).normalize();
      body.vel.copy(body.h);
      body.vy = 0;
      const rideAir = this.WH + this.rideH + this.wbob - player.floor - S.hover;
      const targetAir = Math.max(0.01, rideAir);
      body.air += (targetAir - body.air) * k;
      if ((this.t > 1.2 && player.m0 > 0.6) || this.t > 16) {
        this.on = false;
        this.cool = 4;
        player.release(this, { vy: 4.5, boost: 0.9 });
      }
    }
    // 고래·혜성에 탄 동안 카메라가 뒤로 물러난다
    const rideTarget = player.holderCamera === "ride" ? 1 : 0;
    const blendPull = ease(3, dt);
    camera.easeRide(rideTarget, blendPull);
  }

  /** 치운다 */
  dispose() {
    this.g.removeFromParent();
    this.prim.geometry.dispose();
    this.prim.material.dispose();
  }

  // 출발점 둘레를 돈다. 반지름이 바뀌어도 도는 빠르기(m/s)는 70m 일 때와 같게
  private move(f: Frame) {
    const wdeg = (f.time * 5.73 * 70) / this.WR / S.wide;
    const bobPhase = f.time * 0.6;
    this.wbob = Math.sin(bobPhase) * 1.2;
    fromInto(this.v, this.WR, wdeg);
    const aheadDeg = wdeg + 1.5;
    fromInto(ahead, this.WR, aheadDeg);
    this.f.copy(ahead).sub(this.v);
    const fUp = this.f.dot(this.v);
    this.f.addScaledVector(this.v, -fUp).normalize();
    const whaleRadius = S.R + this.WH + this.wbob;
    this.g.position.copy(this.v).multiplyScalar(whaleRadius);
    bx.crossVectors(this.v, this.f).normalize().negate();
    m4.makeBasis(this.f, this.v, bx);
    this.g.quaternion.setFromRotationMatrix(m4);
  }
}

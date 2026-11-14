import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Random } from "../core/random";
import type { Holder } from "../player/player";
import type { Services } from "../services";
import { S } from "../settings";
import { fromInto } from "../world/sphere";

// 혜성 — 하늘을 빠르게 가로지른다. 높이 떠 있을 때 닿으면 올라타 멀리 날아간다

/** 혜성이 나는 높이 */
const CH = 46;

const bx = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  ahead = new THREE.Vector3(),
  ps = new THREE.Vector3();

/** 혜성(나를 붙잡는다) */
export class Comet implements Thing, Holder {
  /** 등에 타 있는 동안 카메라가 뒤로 물러나고, 중력이 멈춘다 */
  readonly cameraMode = "ride";
  readonly freezesGravity = true;
  readonly g = new THREE.Group();
  /** 지금 자리와 나아가는 쪽 */
  readonly v = new THREE.Vector3();
  readonly f = new THREE.Vector3();
  private readonly mat = new THREE.MeshBasicMaterial({ color: 0xffd21f, fog: false });
  private readonly ballGeo = new THREE.SphereGeometry(2.2, 20, 14);
  private readonly tailGeo = new THREE.ConeGeometry(1.9, 15, 16, 1, true);
  private readonly tailMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    fog: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private on = false;
  private t = 0;
  private cool = 0;
  private readonly rng: Random;

  constructor(private readonly s: Services) {
    this.rng = s.rng.fork("comet");
    const ball = new THREE.Mesh(this.ballGeo, this.mat);
    const tail = new THREE.Mesh(this.tailGeo, this.tailMat);
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -8;
    this.g.add(ball, tail);
    s.scene.add(this.g);
  }

  /** 하늘을 돌고, 높이 떠서 닿으면 올라타며, 끌면 뛰어내린다 */
  update(f: Frame) {
    const { player, mats, fx, hud } = this.s,
      dt = f.dt;
    const cdeg = ((f.time * 26) / (120 * S.wide)) * 57.2958 + 40;
    const cometDeg = -cdeg;
    fromInto(this.v, 120, cometDeg);
    const aheadDeg = -cdeg - 1;
    fromInto(ahead, 120, aheadDeg);
    this.f.copy(ahead).sub(this.v);
    const fUp = this.f.dot(this.v);
    this.f.addScaledVector(this.v, -fUp).normalize();
    const cometRadius = S.R + CH;
    this.g.position.copy(this.v).multiplyScalar(cometRadius);
    bx.crossVectors(this.v, this.f).normalize().negate();
    m4.makeBasis(this.f, this.v, bx);
    this.g.quaternion.setFromRotationMatrix(m4);
    const cometLit = this.on ? 1 : 0;
    this.mat.color.copy(mats.toy.comet).lerp(mats.lime, cometLit);
    if (this.cool > 0) this.cool -= dt;
    const altOffset = player.alt - CH;
    if (
      !this.on &&
      this.cool <= 0 &&
      !player.held &&
      player.air > 6 &&
      player.p.angleTo(this.v) * S.R < 16 &&
      Math.abs(altOffset) < 13 &&
      player.grab(this)
    ) {
      this.on = true;
      this.t = 0;
      hud.say("혜성 — 끌면 뛰어내립니다");
    }
    const body = player.bodyFor(this);
    if (!this.on || !body) return;
    this.t += dt;
    const k = ease(7, dt);
    body.p.lerp(this.v, k).normalize();
    body.h.lerp(this.f, k);
    const hUp = body.h.dot(body.p);
    body.h.addScaledVector(body.p, -hUp).normalize();
    body.vel.copy(body.h);
    body.vy = 0;
    const rideAir = CH + 2.9 - player.floor - S.hover;
    const targetAir = Math.max(0.01, rideAir);
    body.air += (targetAir - body.air) * k;
    if (this.rng.next() < 0.5) {
      ps.copy(this.g.position).addScaledVector(this.f, -6);
      fx.burst(ps, 1, 3);
    }
    if ((this.t > 1 && player.m0 > 0.6) || this.t > 16) {
      this.on = false;
      this.cool = 5;
      player.release(this, { vy: 5, boost: 3.2, stun: 0.6 });
    }
  }

  /** 치운다 */
  dispose() {
    this.g.removeFromParent();
    this.mat.dispose();
    this.ballGeo.dispose();
    this.tailGeo.dispose();
    this.tailMat.dispose();
  }
}

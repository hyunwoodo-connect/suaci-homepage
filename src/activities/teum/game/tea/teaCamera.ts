import * as THREE from "three";

import { ease } from "../core/frame";
import { S } from "../settings";
import type { TeaBody } from "./body";
import type { StandShape } from "./stand";

// 티타임 행성의 따라오는 카메라. 거리·높이·시야는 지금 게임 값 그대로(S.camD·S.camH·S.fov)이고,
// 빨라지면 뒤로 물러나고 시야가 넓어지는 셈도 같다. 다른 것: 접시 아래에서는 접시 아랫면 밑에, 기둥 속으로는 안 들어간다.
// 놀이기구에 실려 가는 동안은 조금 물러나 높이 본다(대포로 날 때 스탠드 옆면이 보이게)

/** 실려 가는 동안 더 오르고(m) 물러나는(m) 만큼 */
const RIDE = { rise: 3, back: 6 } as const;
/** 기둥 앞으로 당긴 거리의 이만큼 위로 올린다 */
const PULL_RISE = 0.4;
/** 접시 아랫면·기둥에서 띄우는 거리(m) */
const CLEAR = 0.45;

const head = new THREE.Vector3(),
  span = new THREE.Vector3(),
  center = new THREE.Vector3();
const want = new THREE.Vector3(),
  look = new THREE.Vector3(),
  cdir = new THREE.Vector3(),
  cn = new THREE.Vector3();

/** 따라오는 카메라 */
export class TeaCamera {
  /** 행성 전경을 보는 몫(0 따라오기 · 1 전경) — 판 시작 장면이 쓴다 */
  overview = 0;
  private ride = 0;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly body: TeaBody,
    private readonly stand: StandShape,
  ) {
    camera.fov = S.fov;
    camera.near = 0.1;
    camera.far = 1000;
  }

  /** 카메라를 이번 프레임 자리에 놓는다 */
  update(dt: number) {
    const { body, camera, stand } = this;
    const p = body.p,
      P = body.P;
    const rideWant = body.isHeld ? 1 : 0;
    this.ride += (rideWant - this.ride) * ease(2.5, dt);
    const rB = this.ride;
    cdir.copy(body.h);
    const sp = THREE.MathUtils.clamp(body.tot, 0, 2.2);
    const rise = S.camH + body.air * 0.22 + RIDE.rise * rB;
    const back = -S.camD * (1 + 0.22 * sp) - body.air * 0.35 - RIDE.back * rB;
    want.copy(P).addScaledVector(p, rise).addScaledVector(cdir, back);
    head.copy(P).addScaledVector(p, 0.8);
    this.clipToColumn(head, want);
    if (this.overview > 0) {
      // 전경: 스탠드 전체가 보이게 멀리 위에서
      const far = this.overviewPoint(look);
      want.lerp(far, this.overview);
    }
    if (body.takeSnap()) camera.position.copy(want);
    else {
      const follow = ease(6, dt);
      camera.position.lerp(want, follow);
    }
    this.keepClear(camera.position);
    const up = this.overview > 0.5 ? stand.R : 0;
    if (up > 0) camera.up.set(0, 1, 0);
    else camera.up.copy(p);
    look.copy(P).addScaledVector(p, 0.8).addScaledVector(cdir, 5);
    if (this.overview > 0) {
      center.set(0, 0, 0);
      center.y = stand.R + 14;
      look.lerp(center, this.overview);
    }
    camera.lookAt(look);
    const fov = S.fov + 9 * Math.min(1.6, sp);
    const fovDelta = camera.fov - fov;
    if (Math.abs(fovDelta) > 0.05) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  /** 창 크기에 맞춘다 */
  resize(renderer: THREE.WebGLRenderer) {
    renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // 행성 전경을 보는 자리: 내가 선 쪽 위 멀리서 스탠드를 본다
  private overviewPoint(out: THREE.Vector3): THREE.Vector3 {
    const side = new THREE.Vector3(this.body.p.x, 0, this.body.p.z);
    if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
    side.normalize();
    const R = this.stand.R;
    const height = R + 22,
      away = R + 46;
    out.set(0, 0, 0);
    out.y = height;
    return out.addScaledVector(side, away);
  }

  // 머리에서 카메라까지 사이에 기둥이 있으면 기둥 앞으로 당긴다(3단에서 바깥을 볼 때 카메라가 기둥에 붙지 않게)
  private clipToColumn(from: THREE.Vector3, to: THREE.Vector3) {
    const { stand } = this;
    const reach = stand.columnR + CLEAR;
    span.subVectors(to, from);
    const a = span.x * span.x + span.z * span.z;
    if (a < 1e-8) return;
    const b = 2 * (from.x * span.x + from.z * span.z);
    const c = from.x * from.x + from.z * from.z - reach * reach;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return;
    const root = Math.sqrt(disc);
    const t = (-b - root) / (2 * a);
    if (t <= 0 || t >= 1) return;
    const hitY = from.y + span.y * t;
    const columnTop = stand.R + stand.top;
    if (hitY > columnTop) return;
    const length = span.length();
    const back = CLEAR / length;
    const before = t - back;
    const keep = Math.max(0, before);
    to.copy(from).addScaledVector(span, keep);
    // 당긴 만큼 위로 올려 머리 너머로 내려다본다(가까이 붙어도 앞이 보이게)
    const lost = (1 - keep) * length * PULL_RISE;
    cn.copy(from).normalize();
    to.addScaledVector(cn, lost);
  }

  // 접시 아랫면 밑·바닥 위·기둥 밖에 둔다
  private keepClear(pos: THREE.Vector3) {
    const { stand, body } = this;
    cn.copy(pos).normalize();
    const R = stand.R;
    let alt = pos.length() - R;
    const floor = stand.floorBelow(cn, alt, 0);
    const ceiling = stand.ceilingAbove(cn, body.alt);
    const isUnderPlate = ceiling < Infinity && alt < ceiling + 0.5;
    if (isUnderPlate && alt > ceiling - CLEAR) alt = ceiling - CLEAR;
    const lowest = floor + 1.2;
    if (alt < lowest) alt = lowest;
    stand.pushOutOfColumn(cn, alt, CLEAR);
    const radius = R + alt;
    pos.copy(cn).multiplyScalar(radius);
  }
}

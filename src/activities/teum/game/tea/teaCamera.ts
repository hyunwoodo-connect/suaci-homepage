import * as THREE from "three";

import { ease } from "../core/frame";
import { S } from "../settings";
import type { TeaBody } from "./body";
import type { StandShape } from "./stand";

// 티타임 행성의 따라오는 카메라. 거리·높이·시야는 지금 게임 값 그대로(S.camD·S.camH·S.fov)이고,
// 빨라지면 뒤로 물러나고 시야가 넓어지는 셈도 같다. 위는 내 몸의 위(축 위 ↔ 별 바깥)를 부드럽게 따라간다.
// 카메라와 나 사이에 접시나 기둥이 끼면 막지 않고 그것을 반투명으로 한다(기획서 v3.1 1장 — StandMesh.fadeBetween).
// 놀이기구에 실려 가는 동안은 조금 물러나 높이 본다(대포로 날 때 스탠드 옆면이 보이게)

/** 실려 가는 동안 더 오르고(m) 물러나는(m) 만큼 */
const RIDE = { rise: 3, back: 6 } as const;
/** 별 표면 위로 띄우는 거리(m) */
const ABOVE_GROUND = 1.2;
const UP_Y = new THREE.Vector3(0, 1, 0);

const want = new THREE.Vector3(),
  look = new THREE.Vector3(),
  back = new THREE.Vector3(),
  center = new THREE.Vector3();

/** 따라오는 카메라 */
export class TeaCamera {
  /** 행성 전경을 보는 몫(0 따라오기 · 1 전경) — 판 시작 장면이 쓴다 */
  overview = 0;
  /** 카메라의 위(내 몸의 위를 부드럽게 따라간다) */
  readonly up = new THREE.Vector3(0, 1, 0);
  /** 전경에서 스탠드를 바라보는 쪽(시작 자리 쪽 수평 방향) */
  readonly overviewSide = new THREE.Vector3(0, 0, -1);
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
    const { body, camera } = this;
    const snap = body.takeSnap();
    const upK = snap ? 1 : ease(5, dt);
    this.up.lerp(body.p, upK).normalize();
    const up = this.up;
    const rideWant = body.isHeld ? 1 : 0;
    this.ride += (rideWant - this.ride) * ease(2.5, dt);
    const rB = this.ride;
    // 보는 쪽을 카메라의 위에 수직으로
    const hUp = body.h.dot(up);
    back.copy(body.h).addScaledVector(up, -hUp).normalize();
    const sp = THREE.MathUtils.clamp(body.tot, 0, 2.2);
    const rise = S.camH + body.air * 0.22 + RIDE.rise * rB;
    const behind = S.camD * (1 + 0.22 * sp) + body.air * 0.35 + RIDE.back * rB;
    want.copy(body.P).addScaledVector(up, rise).addScaledVector(back, -behind);
    look.copy(body.P).addScaledVector(up, 0.8).addScaledVector(back, 5);
    if (this.overview > 0) {
      const far = this.overviewPoint(center);
      want.lerp(far, this.overview);
      center.set(0, 0, 0);
      center.y = this.stand.R + 14;
      look.lerp(center, this.overview);
    }
    if (snap) camera.position.copy(want);
    else {
      const follow = ease(6, dt);
      camera.position.lerp(want, follow);
    }
    this.keepAboveGround(camera.position);
    camera.up.copy(up).lerp(UP_Y, this.overview).normalize();
    camera.lookAt(look);
    const widen = 9 * Math.min(1.6, sp);
    const fov = S.fov + widen;
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

  // 행성 전경을 보는 자리: 시작 자리 쪽 멀리 위에서 스탠드 전체를 본다
  private overviewPoint(out: THREE.Vector3): THREE.Vector3 {
    const R = this.stand.R;
    const height = R + 22,
      away = R + 46;
    out.set(0, 0, 0);
    out.y = height;
    return out.addScaledVector(this.overviewSide, away);
  }

  // 별 속으로는 들어가지 않는다
  private keepAboveGround(pos: THREE.Vector3) {
    const lowest = this.stand.R + ABOVE_GROUND;
    if (pos.length() < lowest) pos.setLength(lowest);
  }
}

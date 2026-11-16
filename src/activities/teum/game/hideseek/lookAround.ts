import * as THREE from "three";

import { ease } from "../core/frame";
import type { Services } from "../services";
import { HIDE } from "./tuning";

// 멈춰서 둘러보기(시험 — 주소에 ?look=1 일 때만): 끌지 않고 look.holdSeconds 넘게 누르고 있으면 그 자리에 멈추고
// 카메라가 천천히 한 바퀴 돈다. 손을 떼면 풀린다. 따라가는 카메라가 자리를 잡은 뒤에 돌아 그 프레임만 카메라를 빌린다

/** 도는 빠르기(rad/s — 10초에 한 바퀴) · 뒤로(m) · 위로(m) */
const TURN = 0.63,
  BACK = 9,
  RISE = 4.2;

const orbit = new THREE.Vector3(),
  aim = new THREE.Vector3(),
  rigAim = new THREE.Vector3();

/** 멈춰서 둘러보기 카메라 */
export class LookAround {
  /** 둘러보기로 넘어간 정도(0 따라가는 카메라 … 1 도는 카메라)와 돈 각(rad) */
  private k = 0;
  private angle = 0;

  constructor(
    private readonly s: Services,
    private readonly pressSeconds: () => number,
  ) {}

  /** 한 프레임(canLook: 지금 둘러봐도 되는 장면인가) */
  update(dt: number, canLook: boolean) {
    const { player, camera } = this.s;
    const held = this.pressSeconds();
    const looking = canLook && held >= HIDE.look.holdSeconds;
    if (looking) {
      player.slowDown(6);
      this.angle += TURN * dt;
    }
    const target = looking ? 1 : 0,
      k = ease(4, dt);
    this.k += (target - this.k) * k;
    if (this.k < 0.01) {
      this.k = 0;
      this.angle = 0;
      return;
    }
    const cam = camera.camera,
      p = player.p as THREE.Vector3,
      P = player.P;
    orbit.copy(player.h).multiplyScalar(-BACK).applyAxisAngle(p, this.angle);
    orbit.add(P).addScaledVector(p, RISE);
    aim.copy(P).addScaledVector(p, 0.6);
    cam.getWorldDirection(rigAim);
    rigAim.multiplyScalar(10).add(cam.position);
    cam.position.lerp(orbit, this.k);
    rigAim.lerp(aim, this.k);
    cam.up.copy(p);
    cam.lookAt(rigAim);
  }

  /** 카메라를 바로 놓는다(꾸미기 씬이 카메라를 쓴다) */
  drop() {
    this.k = 0;
  }
}

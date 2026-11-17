import * as THREE from "three";

import { ease } from "../core/frame";
import type { Services } from "../services";

// 카메라를 잠깐 빌린다(따라가는 카메라가 자리를 잡은 뒤에 돈다):
//   look — 생물을 화면 가운데로 잡는다(누른 생물이 무엇을 하는지 보이게). 내 뒤 위에서 그 생물 쪽을 본다
//   down — 높이 떠 있는 동안 아래를 내려다본다(버섯). 물건 뒤 귀가 보이게
// 빌리는 시간이 끝나면 따라가는 카메라로 부드럽게 돌아간다

/** 생물을 볼 때 내 뒤(m)·위(m), 내려다볼 때 내 뒤(m)·위(m)·앞으로 내려다보는 곳(m) */
const LOOK_BACK = 9,
  LOOK_RISE = 4,
  DOWN_BACK = 6,
  DOWN_RISE = 9,
  DOWN_AHEAD = 14;

const want = new THREE.Vector3(),
  aim = new THREE.Vector3(),
  rigAim = new THREE.Vector3(),
  toward = new THREE.Vector3();

/** 잠깐 빌리는 카메라 */
export class CameraFocus {
  /** 빌린 정도(0 따라가는 카메라 … 1 빌린 카메라) · 남은 시간(초) · 하는 일 */
  private k = 0;
  private left = 0;
  private mode: "look" | "down" = "look";
  private where: ((out: THREE.Vector3) => void) | null = null;

  constructor(private readonly s: Services) {}

  /** seconds 초 동안 where(세계 자리) 쪽을 화면 가운데로 잡는다 */
  look(where: (out: THREE.Vector3) => void, seconds: number) {
    this.mode = "look";
    this.where = where;
    this.left = seconds;
  }

  /** seconds 초 동안 아래를 내려다본다 */
  down(seconds: number) {
    this.mode = "down";
    this.where = null;
    this.left = seconds;
  }

  /** 바로 놓는다(새 판·꾸미기 씬) */
  drop() {
    this.left = 0;
    this.k = 0;
  }

  /** 한 프레임 */
  update(dt: number) {
    if (this.left > 0) this.left -= dt;
    const target = this.left > 0 ? 1 : 0,
      k = ease(5, dt);
    this.k += (target - this.k) * k;
    if (this.k < 0.01) {
      this.k = 0;
      return;
    }
    const { player, camera } = this.s,
      cam = camera.camera,
      p = player.p as THREE.Vector3,
      P = player.P;
    if (this.mode === "look" && this.where) {
      this.where(aim);
      // 그 생물 쪽(땅에 붙인 방향)을 보며 내 뒤 위에 선다
      toward.copy(aim).sub(P);
      const up = toward.dot(p);
      toward.addScaledVector(p, -up);
      if (toward.lengthSq() < 1e-6) toward.copy(player.h);
      toward.normalize();
      want.copy(P).addScaledVector(p, LOOK_RISE).addScaledVector(toward, -LOOK_BACK);
    } else {
      want.copy(P).addScaledVector(p, DOWN_RISE).addScaledVector(player.h, -DOWN_BACK);
      // 내 앞 땅 위를 본다(떠 있는 높이만큼 내려서)
      aim.copy(P).addScaledVector(player.h, DOWN_AHEAD).addScaledVector(p, -player.air);
    }
    cam.getWorldDirection(rigAim);
    rigAim.multiplyScalar(10).add(cam.position);
    cam.position.lerp(want, this.k);
    rigAim.lerp(aim, this.k);
    cam.up.copy(p);
    cam.lookAt(rigAim);
  }
}

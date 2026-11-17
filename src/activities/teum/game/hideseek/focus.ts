import * as THREE from "three";

import { ease } from "../core/frame";
import type { Services } from "../services";

// 카메라를 잠깐 빌린다(따라가는 카메라가 자리를 잡은 뒤에 돈다):
//   look — 생물(또는 내려오는 전설)을 화면 가운데로 잡는다. 내 뒤 위에서 그쪽을 보고, 생물 키가 화면 높이의 LOOK_FILL 넘게
//          되게 화각을 좁힌다(다가가지 않는다). 힌트에 방향이 있으면(토끼·병정·컵케이크) 그쪽으로 LOOK_LEAN 더 틀어 생물과 방향이 같이 담긴다
//   down — 높이 떠 있는 동안 아래로 숙여 광장을 내려다본다(버섯)
// 빌리는 시간이 끝나거나 내가 끌면 따라가는 카메라로 부드럽게 돌아간다

/** 생물을 볼 때 내 뒤(m, 따라가는 카메라보다 더 물러나지는 않는다 — 뒤의 큰 물건 속으로 들어가지 않게)·위(m) · 생물 키가 화면 높이에서 차지할 몫 · 방향 쪽으로 더 트는 각(도) · 들어가는·돌아가는 빠르기 */
const LOOK_BACK = 9,
  LOOK_RISE = 4,
  LOOK_FILL = 0.18,
  LOOK_LEAN = 15,
  LEAN_SHARE = 0.6,
  MIN_FOV = 26,
  EASE_IN = 7.5,
  EASE_OUT = 6;
/** 내려다볼 때 내 뒤(m)·위(m)·숙이는 각(도) */
const DOWN_BACK = 6,
  DOWN_RISE = 6,
  DOWN_DEGREES = 55;

const want = new THREE.Vector3(),
  aim = new THREE.Vector3(),
  rigAim = new THREE.Vector3(),
  toward = new THREE.Vector3(),
  lean = new THREE.Vector3(),
  cross = new THREE.Vector3();

/** 생물을 잡는 법: 자리(프레임마다 묻는다) · 키(m — 화면을 채우는 몫을 잰다) · 힌트가 가리키는 곳(없으면 null) */
export interface FocusTarget {
  where: (out: THREE.Vector3) => void;
  height: number;
  hint: ((out: THREE.Vector3) => boolean) | null;
}

/** 잠깐 빌리는 카메라 */
export class CameraFocus {
  /** 빌린 정도(0 따라가는 카메라 … 1 빌린 카메라) · 남은 시간(초) · 하는 일 */
  private k = 0;
  private left = 0;
  private mode: "look" | "down" = "look";
  private target: FocusTarget | null = null;

  /** isDragging: 지금 끌고 있나(끌면 바로 놓는다) */
  constructor(
    private readonly s: Services,
    private readonly isDragging: () => boolean,
  ) {}

  /** seconds 초 동안 target 을 화면 가운데로 잡는다 */
  look(target: FocusTarget, seconds: number) {
    this.mode = "look";
    this.target = target;
    this.left = seconds;
  }

  /** seconds 초 동안 아래를 내려다본다 */
  down(seconds: number) {
    this.mode = "down";
    this.target = null;
    this.left = seconds;
  }

  /** 내려다보는 중이면 부드럽게 돌려준다(다른 보기는 그대로) */
  endDown() {
    if (this.mode === "down") this.left = 0;
  }

  /** 바로 놓는다(새 판·꾸미기 씬) */
  drop() {
    this.left = 0;
    this.k = 0;
  }

  /** 한 프레임 */
  update(dt: number) {
    // 끌면 돌려준다(내려다보는 동안은 끌어서 둘러본다 — 놓지 않는다)
    if (this.left > 0 && this.mode === "look" && this.isDragging()) this.left = 0;
    if (this.left > 0) this.left -= dt;
    const isOn = this.left > 0,
      target = isOn ? 1 : 0,
      rate = isOn ? EASE_IN : EASE_OUT,
      k = ease(rate, dt);
    this.k += (target - this.k) * k;
    if (this.k < 0.01) {
      this.k = 0;
      return;
    }
    const { player, camera } = this.s,
      cam = camera.camera,
      p = player.p as THREE.Vector3,
      P = player.P;
    let fov = cam.fov;
    if (this.mode === "look" && this.target) {
      const t = this.target;
      t.where(aim);
      // 그 생물 쪽(땅에 붙인 방향)을 보며 내 뒤 위에 선다
      toward.copy(aim).sub(P);
      const up = toward.dot(p);
      toward.addScaledVector(p, -up);
      if (toward.lengthSq() < 1e-6) toward.copy(player.h);
      toward.normalize();
      // 따라가는 카메라가 서 있던 거리(땅에 붙인)보다 더 물러나지 않는다
      lean.copy(cam.position).sub(P);
      const camUp = lean.dot(p);
      lean.addScaledVector(p, -camUp);
      const rigBack = lean.length(),
        back = Math.min(LOOK_BACK, rigBack);
      want.copy(P).addScaledVector(p, LOOK_RISE).addScaledVector(toward, -back);
      const dist = want.distanceTo(aim),
        need = t.height / (2 * dist * LOOK_FILL),
        needFov = (2 * Math.atan(need) * 180) / Math.PI,
        // 작은 생물(열쇠)은 화각을 너무 좁히면 뒤의 물건이 화면을 덮는다 — MIN_FOV 아래로는 좁히지 않는다
        least = Math.max(MIN_FOV, needFov),
        narrow = Math.min(cam.fov, least);
      fov = cam.fov + (narrow - cam.fov) * this.k;
      if (t.hint?.(lean)) this.leanToward(aim, lean, p, fov, cam.aspect);
    } else {
      want.copy(P).addScaledVector(p, DOWN_RISE).addScaledVector(player.h, -DOWN_BACK);
      const pitch = (DOWN_DEGREES * Math.PI) / 180,
        fwd = Math.cos(pitch) * 10,
        dip = -Math.sin(pitch) * 10;
      aim.copy(want).addScaledVector(player.h, fwd).addScaledVector(p, dip);
    }
    cam.getWorldDirection(rigAim);
    rigAim.multiplyScalar(10).add(cam.position);
    cam.position.lerp(want, this.k);
    rigAim.lerp(aim, this.k);
    cam.up.copy(p);
    cam.lookAt(rigAim);
    const change = fov - cam.fov;
    if (Math.abs(change) < 0.05) return;
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }

  // 보는 곳(aim)을 힌트가 가리키는 곳(at) 쪽으로 LOOK_LEAN 만큼 돌린다 — 카메라 자리(want)를 축으로.
  // 세로 폰에 화각을 좁히면 가로 반폭이 10도 남짓이라, 생물이 화면 밖으로 나가지 않게 가로 반폭의 LEAN_SHARE 까지만 돈다
  private leanToward(
    aim: THREE.Vector3,
    at: THREE.Vector3,
    up: THREE.Vector3,
    fov: number,
    aspect: number,
  ) {
    const look = toward.copy(aim).sub(want),
      hint = at.sub(want);
    const side = cross.crossVectors(look, hint).dot(up),
      sign = side >= 0 ? 1 : -1,
      halfV = (fov * Math.PI) / 360,
      wideTan = Math.tan(halfV) * aspect,
      halfH = Math.atan(wideTan),
      wanted = (LOOK_LEAN * Math.PI) / 180,
      most = halfH * LEAN_SHARE,
      angle = sign * Math.min(wanted, most);
    look.applyAxisAngle(up, angle);
    aim.copy(want).add(look);
  }
}

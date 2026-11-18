import * as THREE from "three";

import type { LimeBox } from "./limebox";

// 숨는 애(상자 하나)의 처지

/** 숨는 애 하나의 처지 */
export interface Seeker {
  box: LimeBox;
  /** 숨음 · 찾음(솟았다 내려앉아 춤추는 중) · 내 뒤 줄에 섬 */
  state: "hidden" | "caught" | "line";
  /** 꼭꼭 숨어라에서 달려갈 곳(출발 자리 뒤쪽 멀리)과 빠르기(m/s, 0 이면 서 있다) */
  to: THREE.Vector3;
  speed: number;
  /** 찾은 차례(칸 번호이자 줄에서의 차례) */
  slot: number;
}

/** 새 숨는 애 */
export function createSeeker(box: LimeBox): Seeker {
  return { box, state: "hidden", to: new THREE.Vector3(), speed: 0, slot: 0 };
}

/** 판을 새로 시작한다: 처지를 처음으로 */
export function resetSeeker(k: Seeker) {
  k.state = "hidden";
  k.speed = 0;
}

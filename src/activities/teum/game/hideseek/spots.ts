import * as THREE from "three";

import { HOME_BEAR, HOME_DIST } from "../player/player";
import { offsetInto } from "../world/sphere";
import { HIDE } from "./tuning";

// 숨바꼭질 무대의 자리: 광장(자리표 마을 0 — 소원 나무가 선 출발 마을) 중심에서 잰 평면 좌표(m).
// offset(마을, 거리, 방위)의 방위 0°가 x, 90°가 y(출발 자리 goHome 과 같은 틀). 무대가 100m 안이라 평면으로 쳐도 된다

/** 무대: 자리표의 마을 차례. 판을 시작하면 이 마을 출발 자리로 옮긴다(오늘의 축제 마을과 상관없이) */
export const STAGE_HUB = HIDE.stage.hub;

/** 상자의 반너비(m — 모델은 키 1.05m 에 너비 0.69m, 키에 맞춰 같이 커진다) */
export const BOX_HALF = (0.345 * HIDE.box.height) / 1.05;

/** 출발 자리(마을 중심 기준 평면 m) */
export function startPoint(): { x: number; y: number } {
  const b = THREE.MathUtils.degToRad(HOME_BEAR);
  const x = HOME_DIST * Math.cos(b),
    y = HOME_DIST * Math.sin(b);
  return { x, y };
}

/** 평면 좌표(m) → 행성 위 자리(단위 벡터) */
export function sphereAt(
  out: THREE.Vector3,
  hub: THREE.Vector3,
  x: number,
  y: number,
): THREE.Vector3 {
  const dist = Math.hypot(x, y);
  if (dist < 1e-6) return out.copy(hub);
  const radians = Math.atan2(y, x);
  const bearing = THREE.MathUtils.radToDeg(radians);
  return offsetInto(out, hub, dist, bearing);
}

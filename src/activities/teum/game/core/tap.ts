import type * as THREE from "three";

// 칙(짧게 톡): 게임이 화면 좌표를 땅에 쏘아 맞은 자리를 정하고, 반응하는 것들에게 정해 둔 차례(TAP_ORDER)로 알린다

/** 칙 한 번: 맞은 땅 자리(하늘을 눌렀으면 null)와 그때 시각 */
export interface Tap {
  ground: THREE.Vector3 | null;
  time: number;
}

/** 칙에 반응하는 것 */
export interface Tappable {
  onTap(tap: Tap): void;
}

/** 칙 둘레에서 가까운 것부터 차례로 울리는 거리(m) */
export const ECHO_REACH = 18;

/** 칙 자리에서 dist 떨어진 것이 울릴 시각 */
export function echoTime(tap: Tap, dist: number): number {
  return tap.time + 0.05 + dist * 0.05;
}

/** 종이 울릴 때 같이 울리는 것(기둥·통통 구름·고리): 울릴 시각이 된 것을 울린다 */
export interface Echoing {
  echo(time: number): void;
}

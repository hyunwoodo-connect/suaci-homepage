import type { EventDetail } from "@/types";

/** 레코드 스위치로 켜는 기능 중 이 놀이가 아는 것. */
export type Stage = "wall" | "entry";

/**
 * 코드에 나와 있는 기능. 레코드 스위치만 켜지고 기능이 없으면 막다른 길이라, 레코드 스위치와 AND로 막는다.
 * 기능을 내보낼 때 그 값을 true로 바꾼다.
 */
export const STAGE = { wall: true, entry: false } as const satisfies Record<Stage, boolean>;

/** 그 기능이 코드에 나와 있고 레코드 스위치도 켜졌으면 true. */
export function isStageOn(
  event: Pick<EventDetail, "switches">,
  stage: Stage,
  shipped: Record<Stage, boolean> = STAGE,
): boolean {
  return shipped[stage] && event.switches[stage] === true;
}

/** 완성 화면 주 행동 자리에 `벽에 붙이기`를 둘지. 응모가 켜지면 그 자리는 응모가 쓴다. */
export function canPostToWall(
  event: Pick<EventDetail, "switches">,
  shipped: Record<Stage, boolean> = STAGE,
): boolean {
  return isStageOn(event, "wall", shipped) && !isStageOn(event, "entry", shipped);
}

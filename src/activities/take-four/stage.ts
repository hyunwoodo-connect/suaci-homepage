import type { EventDetail } from "@/types";

/** 레코드 스위치로 켜는 기능 중 이 놀이가 아는 것. */
export type Stage = "wall" | "entry";

/**
 * 코드에 나와 있는 단계. 레코드 스위치만 켜지고 기능이 없으면 막다른 길이라, 레코드 스위치와 AND로 막는다.
 * wall(다른 사람들 네컷 보기)은 2단계에서 나왔고, entry(응모하기)는 3단계를 내보낼 때 true로 바꾼다.
 */
export const STAGE = { wall: true, entry: false } as const satisfies Record<Stage, boolean>;

/** 그 단계가 코드에 나와 있고 레코드 스위치도 켜졌으면 true. */
export function isStageOn(
  event: Pick<EventDetail, "switches">,
  stage: Stage,
  shipped: Record<Stage, boolean> = STAGE,
): boolean {
  return shipped[stage] && event.switches[stage] === true;
}

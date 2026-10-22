import { TAKE_FOUR } from "./take-four";
import type { ActivityModule } from "./types";

const ACTIVITIES: Record<string, ActivityModule> = { [TAKE_FOUR.id]: TAKE_FOUR };

/** 이벤트 레코드의 activityId로 놀이 모듈을 찾는다. */
export function getActivity(activityId: string): ActivityModule | undefined {
  return Object.hasOwn(ACTIVITIES, activityId) ? ACTIVITIES[activityId] : undefined;
}

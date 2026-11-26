import { TAKE_FOUR } from "./take-four";
import { TEUM } from "./teum";
import type { ActivityModule } from "./types";

const ACTIVITIES: Record<string, ActivityModule> = { [TAKE_FOUR.id]: TAKE_FOUR, [TEUM.id]: TEUM };

/** 이벤트 레코드의 activityId로 놀이 모듈을 찾는다. */
export function getActivity(activityId: string): ActivityModule | undefined {
  return Object.hasOwn(ACTIVITIES, activityId) ? ACTIVITIES[activityId] : undefined;
}

/** 그 놀이가 내 아바타를 데리고 들어가나(모르는 놀이는 아니다) */
export function usesAvatar(activityId: string): boolean {
  return getActivity(activityId)?.usesAvatar === true;
}

import type { ReactNode } from "react";

import type { EventDetail } from "@/types";

import { TAKE_FOUR } from "./take-four";

export interface EntranceProps {
  event: EventDetail;
  /** 요청 UA. 놀이가 PC·인앱 화면을 서버에서 고르는 데 쓴다 */
  userAgent: string;
  /** 이 페이지의 절대 주소(쓸 수 있는 미리보기 토큰 포함). 인앱에서 밖의 브라우저로 넘길 때 쓴다 */
  url: string;
}

/** 놀이 모듈. 이벤트 페이지(`/events/{slug}`)와 그 아래 화면을 그린다. */
export interface ActivityModule {
  id: string;
  Entrance: (props: EntranceProps) => ReactNode;
  /** `/events/{slug}/{...rest}` 화면. 모르는 경로면 null(→ 404) */
  route(rest: string[], event: EventDetail): ReactNode | null;
}

const ACTIVITIES: Record<string, ActivityModule> = { [TAKE_FOUR.id]: TAKE_FOUR };

/** 이벤트 레코드의 activityId로 놀이 모듈을 찾는다. */
export function getActivity(activityId: string): ActivityModule | undefined {
  return Object.hasOwn(ACTIVITIES, activityId) ? ACTIVITIES[activityId] : undefined;
}

import type { ReactNode } from "react";

import type { EventDetail } from "@/types";

/** 입구·하위 화면이 받는 요청 정보. */
export interface RouteContext {
  /** 요청 UA. PC·인앱·카메라 안내를 서버에서 고른다(깜빡임 없이) */
  userAgent: string;
  /** 입구의 절대 주소(쓸 수 있는 미리보기 토큰 포함). PC QR·밖의 브라우저로 넘길 때 쓴다 */
  url: string;
}

/** 놀이 모듈의 입구 화면이 받는 값 — 요청 정보와 이벤트 레코드 */
export interface EntranceProps extends RouteContext {
  event: EventDetail;
}

/** 놀이 모듈. 이벤트 페이지(`/events/{slug}`)와 그 아래 화면을 그린다. */
export interface ActivityModule {
  id: string;
  /** 내 아바타(사이트 공용 — lib/avatar)를 데리고 들어가는 놀이. 이런 놀이가 목록에 있으면 이벤트 페이지에 아바타가 선다 */
  usesAvatar?: boolean;
  Entrance: (props: EntranceProps) => ReactNode;
  /** `/events/{slug}/{...rest}` 화면. 모르는 경로면 null(→ 404) */
  route(rest: string[], event: EventDetail, ctx: RouteContext): ReactNode | null;
}

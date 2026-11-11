import type * as Api from "./api.gen";

/** 이벤트 진행 상태(백엔드 `phase`) — 시작 전·진행 중·끝남 */
export type EventPhase = Api.EventPhase;
/** 이벤트 목록 카드에 쓰는 값. `order` 순서로 늘어선다 */
export type EventCard = Api.EventCard;
/** 이벤트 목록 한 줄. 시각은 `*At`=Unix ms, `*Dtm`=KST ISO 문자열 */
export type EventSummary = Api.EventSummaryView;
/** 이벤트 안내 문구 — 상태(발표 포함)마다 한 줄 */
export type EventCopy = Api.EventCopy;
/** 이벤트 상세(`GET /events/{slug}`) — 목록 항목에 문구·스위치·언어를 더한 것 */
export type EventDetail = Api.EventDetailView;

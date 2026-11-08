/** 이벤트 진행 상태(백엔드 `phase`) — 시작 전·진행 중·끝남 */
export type EventPhase = "upcoming" | "live" | "ended";

/** 이벤트 목록 카드에 쓰는 값. `order` 순서로 늘어선다 */
export interface EventCard {
  title: string;
  summary: string;
  thumbnail?: string;
  order: number;
}

/** 시각은 `*At`=Unix ms, `*Dtm`=KST ISO 문자열. */
export interface EventSummary {
  eventId: string;
  slug: string;
  activityId: string;
  phase: EventPhase;
  startAt: number;
  startDtm: string;
  endAt: number;
  endDtm: string;
  announceAt?: number;
  announceDtm?: string;
  card: EventCard;
}

/** 이벤트 안내 문구 — 상태(발표 포함)마다 한 줄 */
export interface EventCopy {
  upcoming?: string;
  live?: string;
  ended?: string;
  announced?: string;
}

/** 이벤트 상세(`GET /events/{slug}`) — 목록 항목에 문구·스위치·언어를 더한 것 */
export interface EventDetail extends EventSummary {
  copy: EventCopy;
  switches: Record<string, boolean>;
  locales: string[];
}

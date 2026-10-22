import { getEventContent } from "@/events";
import type { EventContent } from "@/events";
import { formatKoreanMonthDay } from "@/lib/eventDate";
import type { EventCopy, EventDetail } from "@/types";

/** 이벤트 문구에 채우는 날짜. 기간 형식은 쓰는 곳이 정하고, 발표일은 늘 KST `M월 D일`(없으면 null). */
export interface EventDates {
  start: string;
  end: string;
  announce: string | null;
}

/**
 * take four. 위에 얹는 이벤트가 채우는 내용. 놀이가 받는 모양을 놀이가 정하고,
 * 이벤트 모듈(`src/events/`)이 `satisfies TakeFourEventContent`로 맞춘다.
 */
export interface TakeFourEventContent extends EventContent {
  activityId: "take-four";
  /** 입구 쪽지 문구(이벤트 기간에 주는 것) */
  note: string;
  /** 안내 화면 `받는 것` */
  reward: string;
  /** 레코드 `copy`가 비었을 때 phase별 안내 문구 */
  fallbackCopy: Record<keyof EventCopy, (dates: EventDates) => string>;
  /** 벽 안내 띠 두 줄(머리·본문) phase별. 머리 앞에는 놀이가 `{label} · `를 붙인다 */
  wallNotice: Record<keyof EventCopy, (dates: EventDates) => readonly [string, string]>;
  /** 떼기 시트에서 `벽에서만 내려요.` 뒤에 붙는 문구 */
  removeNote?: string;
}

/** 레코드 eventId의 이벤트 내용. take four. 위에 얹힌 이벤트가 아니거나 내용이 없으면 undefined. */
export function getTakeFourContent(eventId: string): TakeFourEventContent | undefined {
  const content = getEventContent(eventId);
  return content?.activityId === "take-four" ? (content as TakeFourEventContent) : undefined;
}

/** 레코드 기간·발표일을 문구용 날짜로. 기간은 `formatPeriod`로, 발표일은 `M월 D일`. */
export function eventDates(
  event: Pick<EventDetail, "startAt" | "endAt" | "announceAt">,
  formatPeriod: (ms: number) => string,
): EventDates {
  return {
    start: formatPeriod(event.startAt),
    end: formatPeriod(event.endAt),
    announce: event.announceAt !== undefined ? formatKoreanMonthDay(event.announceAt) : null,
  };
}

import { formatKstMonthDay, formatKstDotDate } from "@/lib/event-date";
import type { EventCopy, EventDetail } from "@/types";

import { eventDates } from "./eventContent";
import type { TakeFourEventContent } from "./eventContent";

/** 안내 화면의 네 상태 — 레코드 phase에 발표 시각을 더한 것(`copy` 키와 같다). */
export type InfoPhase = keyof EventCopy;

export interface InfoView {
  phase: InfoPhase;
  /** 큰 제목 — 이벤트 내용의 회차 이름, 없으면 레코드 카드 제목 */
  title: string;
  /** h1 위 작은 이탤릭(`12.01 open`·`12.01 – 01.10`·`closed`·`01.15`) */
  stamp: string;
  headline: string;
  /** `12월 1일 – 1월 10일` */
  period: string;
  /** 발표일(`1월 15일`). 레코드에 없으면 null */
  announce: string | null;
  reward: string | null;
  cta: string;
}

const CTA: Record<InfoPhase, string> = {
  upcoming: "먼저 찍어 보기",
  live: "찍으러 가기",
  ended: "그냥 찍기",
  announced: "그냥 찍기",
};

/** 마감 뒤 발표 시각이 지났으면 발표 뒤. */
export function infoPhase(event: EventDetail, now: number): InfoPhase {
  if (event.phase !== "ended") return event.phase;
  return event.announceAt !== undefined && now >= event.announceAt ? "announced" : "ended";
}

/**
 * 시안 Event의 phase별 화면 값. 문구는 레코드 `copy`가 먼저, 비었으면 이벤트 내용(`fallbackCopy`).
 * 날짜는 모두 KST.
 */
export function infoView(
  event: EventDetail,
  content: TakeFourEventContent | undefined,
  now: number,
): InfoView {
  const phase = infoPhase(event, now);
  const dates = eventDates(event, formatKstMonthDay);
  const start = formatKstDotDate(event.startAt);
  const stamp = {
    upcoming: `${start} open`,
    live: `${start} – ${formatKstDotDate(event.endAt)}`,
    ended: "closed",
    announced: event.announceAt !== undefined ? formatKstDotDate(event.announceAt) : "",
  }[phase];
  const recordCopy = event.copy[phase]?.trim();
  return {
    phase,
    title: content?.label ?? event.card.title,
    stamp,
    headline: recordCopy || content?.fallbackCopy[phase](dates) || "",
    period: `${dates.start} – ${dates.end}`,
    announce: dates.announce,
    reward: content?.reward ?? null,
    cta: CTA[phase],
  };
}

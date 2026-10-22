import type { EventCopy } from "@/types";

import { NO01 } from "./no01";

/** 안내 화면 문구가 쓰는 날짜(KST `M월 D일`). 발표일이 없는 이벤트면 null. */
export interface EventContentDates {
  start: string;
  end: string;
  announce: string | null;
}

/** 벽 안내 띠 날짜. 기간은 KST `MM.DD`, 발표일은 `M월 D일`(없으면 null). */
export interface WallNoticeDates {
  start: string;
  end: string;
  announce: string | null;
}

/**
 * 이벤트마다 다른 내용(놀이 모듈이 아니라 이벤트 쪽). 레코드에 아직 없는 것만 여기 둔다.
 * 백엔드 레코드에 같은 필드가 생기면 그쪽으로 옮긴다.
 */
export interface EventContent {
  /** 회차 이름(`No.01`). 안내 화면 큰 제목, 입구 쪽지 머리, 띠 캡션·도장 */
  label: string;
  /** 입구 쪽지 문구(이벤트 기간에 주는 것) */
  note: string;
  /** 안내 화면 `받는 것` */
  reward: string;
  /** 레코드 `copy`가 비었을 때 phase별 문구 */
  fallbackCopy: Record<keyof EventCopy, (dates: EventContentDates) => string>;
  /** 벽 안내 띠 두 줄(머리·본문) phase별 */
  wallNotice: Record<keyof EventCopy, (dates: WallNoticeDates) => readonly [string, string]>;
}

const CONTENTS: Record<string, EventContent> = { no01: NO01 };

/** 레코드 eventId로 이벤트 내용을 찾는다. */
export function getEventContent(eventId: string): EventContent | undefined {
  return Object.hasOwn(CONTENTS, eventId) ? CONTENTS[eventId] : undefined;
}

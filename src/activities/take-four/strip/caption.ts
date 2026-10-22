import { kstDateLabel } from "@/lib/eventDate";
import type { EventPhase } from "@/types";

/** 띠 아래 글자. 폰에서 만든 띠엔 번호가 없어 `no.----`로 찍는다. */
export interface StripCaption {
  /** 진행 중·시작 전이면 회차 이름(`No.01`). 이벤트가 끝났거나 이벤트 내용이 없으면 null — 도장도 같이 빠진다 */
  eventLabel: string | null;
  date: Date;
}

/**
 * 지금 이벤트 상태로 캡션을 정한다. 놀이는 상설이라 마감 뒤엔 이벤트 표시만 뺀다.
 * label: 이벤트 내용(`@/events`)의 회차 이름. 없으면 null.
 */
export function stripCaption(phase: EventPhase, date: Date, label: string | null): StripCaption {
  return { eventLabel: phase === "ended" ? null : label, date };
}

/** 캡션 왼쪽 번호와 오른쪽 회차·날짜. 화면 띠(Strip)와 합성 띠가 같은 글자를 쓴다. */
export function captionText(caption: StripCaption): { number: string; meta: string } {
  const date = kstDateLabel(caption.date);
  return {
    number: "no.----",
    meta: caption.eventLabel ? `${caption.eventLabel} · ${date}` : date,
  };
}

/** 저장 파일 이름 */
export function stripFilename(caption: StripCaption): string {
  return `take-four-${kstDateLabel(caption.date).replace(".", "")}.jpg`;
}

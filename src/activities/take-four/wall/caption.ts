import { getEventContent } from "@/events";
import { kstDateLabel } from "@/lib/eventDate";
import type { EventDetail } from "@/types";

import { eventDates, getTakeFourContent } from "../eventContent";
import { infoPhase } from "../info";
import type { StripView } from "./api";

/** 띠 캡션 글자와 도장. */
export interface WallCaption {
  /** `no.0347` */
  number: string;
  /** `No.01 · 12.04`. 이벤트 없이 붙인 네컷이면 빈 글자 */
  meta: string;
  /** 도장 글자(`No.01`). 이벤트 없이 붙인 네컷이면 없음 */
  stamp: string | undefined;
}

/** 벽 네컷의 캡션. 회차·날짜는 붙인 순간 이벤트가 찍혔을 때만(날짜는 붙인 날 KST). */
export function wallCaption(strip: StripView): WallCaption {
  const label = strip.eventId ? getEventContent(strip.eventId)?.label : undefined;
  return {
    number: `no.${String(strip.serial).padStart(4, "0")}`,
    meta: label ? `${label} · ${kstDateLabel(strip.postedAt)}` : "",
    stamp: label,
  };
}

/** 벽 위 이벤트 안내 띠 두 줄. 이벤트 내용이 없으면 null(띠 없음). */
export function wallNotice(event: EventDetail, now: number): { head: string; body: string } | null {
  const content = getTakeFourContent(event.eventId);
  if (!content) return null;
  const [head, body] = content.wallNotice[infoPhase(event, now)](eventDates(event, kstDateLabel));
  return { head: `${content.label} · ${head}`, body };
}

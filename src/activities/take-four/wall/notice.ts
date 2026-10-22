import { formatKstDotDate } from "@/lib/event-date";
import type { EventDetail } from "@/types";

import { eventDates, getTakeFourContent } from "../eventContent";
import { infoPhase } from "../info";

/** 벽 위 이벤트 안내 띠 두 줄. 이벤트 내용이 없으면 null(띠 없음). */
export function wallNotice(event: EventDetail, now: number): { head: string; body: string } | null {
  const content = getTakeFourContent(event.eventId);
  if (!content) return null;
  const [head, body] = content.wallNotice[infoPhase(event, now)](
    eventDates(event, formatKstDotDate),
  );
  return { head: `${content.label} · ${head}`, body };
}

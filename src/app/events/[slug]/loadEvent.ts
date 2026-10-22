import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { eventsApi } from "@/lib/api";
import { validPreviewToken } from "@/lib/event-access";
import type { EventDetail } from "@/types";

/**
 * 이벤트 페이지와 그 아래 화면이 같이 쓰는 이벤트 읽기. 없으면 404.
 * 미들웨어와 같은 모양 검사를 거친 토큰만 API에 넘기고,
 * 쿼리 토큰이 없거나 낡았으면 미들웨어가 심은 쿠키로 대신한다.
 */
export async function loadEvent(slug: string, preview: string | undefined): Promise<EventDetail> {
  const queryToken = validPreviewToken(preview);
  let event = await eventsApi.get(slug, queryToken);
  if (!event) {
    const saved = validPreviewToken((await cookies()).get(`suaci_evt_${slug}`)?.value);
    if (saved && saved !== queryToken) event = await eventsApi.get(slug, saved);
  }
  if (!event) notFound();
  return event;
}

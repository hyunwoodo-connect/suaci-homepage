import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { eventsApi } from "@/lib/api";
import { validPreviewToken } from "@/lib/event-access";
import type { EventDetail } from "@/types";

interface LoadedEvent {
  event: EventDetail;
  /** 이벤트를 연 미리보기 토큰(공개 이벤트면 쿼리 토큰 그대로, 없으면 undefined) */
  previewToken?: string;
}

/**
 * 이벤트 페이지와 그 아래 화면이 같이 쓰는 이벤트 읽기. 없으면 404.
 * 미들웨어와 같은 모양 검사를 거친 토큰만 API에 넘기고,
 * 쿼리 토큰이 없거나 낡았으면 미들웨어가 심은 쿠키로 대신한다.
 */
export async function loadEvent(slug: string, preview: string | undefined): Promise<LoadedEvent> {
  const queryToken = validPreviewToken(preview);
  const event = await eventsApi.get(slug, queryToken);
  if (event) return { event, previewToken: queryToken };
  const saved = validPreviewToken((await cookies()).get(`suaci_evt_${slug}`)?.value);
  if (saved && saved !== queryToken) {
    const viaCookie = await eventsApi.get(slug, saved);
    if (viaCookie) return { event: viaCookie, previewToken: saved };
  }
  notFound();
}

import type { EventDetail, EventSummary } from "@/types";

import { isNotFound } from "./errors";
import { createFetcher } from "./http/fetcher";
import type { Envelope } from "./http/fetcher";
import { createMockEventsApi } from "./mock/events";
import { selectApi } from "./select";

export interface EventsApi {
  list(): Promise<EventSummary[]>;
  /** 없는 이벤트면 null. preview는 미공개 이벤트 미리보기 토큰. */
  get(slug: string, preview?: string): Promise<EventDetail | null>;
}

export function createEventsApi(baseUrl: string): EventsApi {
  const { request } = createFetcher(baseUrl);
  return {
    async list() {
      return (await request<Envelope<EventSummary[]>>("/events")).data;
    },
    async get(slug, preview) {
      try {
        const body = await request<Envelope<EventDetail>>(`/events/${encodeURIComponent(slug)}`, {
          query: { preview },
        });
        return body.data;
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
  };
}

/** 운영에서 주소가 빠져도 가짜 이벤트를 내보내지 않도록 빈 응답으로 둔다. */
export function createEmptyEventsApi(): EventsApi {
  return {
    async list() {
      return [];
    },
    async get() {
      return null;
    },
  };
}

export function selectEventsApi(
  baseUrl: string | undefined,
  nodeEnv: string | undefined,
): EventsApi {
  return selectApi(
    { live: createEventsApi, mock: createMockEventsApi, empty: createEmptyEventsApi },
    baseUrl,
    nodeEnv,
  );
}

export const eventsApi: EventsApi = selectEventsApi(
  process.env.NEXT_PUBLIC_API_BASE_URL,
  process.env.NODE_ENV,
);

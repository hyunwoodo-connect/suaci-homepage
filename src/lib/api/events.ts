import type { EventDetail, EventSummary } from "@/types";
import { ApiClientError } from "./errors";
import { createFetcher } from "./http/fetcher";

interface Envelope<T> {
  data: T;
}

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
        if (err instanceof ApiClientError && err.status === 404) return null;
        throw err;
      }
    },
  };
}

const DAY = 24 * 60 * 60 * 1000;

function buildMockDetail(): EventDetail {
  const now = Date.now();
  return {
    eventId: "evt_take_four",
    slug: "take-four",
    activityId: "act_take_four",
    phase: "live",
    startAt: now - DAY,
    startDtm: new Date(now - DAY + 9 * 60 * 60 * 1000).toISOString().replace("Z", "+09:00"),
    endAt: now + 30 * DAY,
    endDtm: new Date(now + 30 * DAY + 9 * 60 * 60 * 1000).toISOString().replace("Z", "+09:00"),
    card: {
      title: "take four",
      summary: "네 컷으로 남기는 take suaci.",
      order: 1,
    },
    copy: {
      upcoming: "곧 문을 열어요.",
      live: "지금 네 컷을 찍어보세요.",
      ended: "이벤트가 끝났어요.",
    },
    switches: {},
    locales: ["ko"],
  };
}

/** 백엔드 주소가 없을 때(로컬 개발·테스트)의 대역. */
export function createMockEventsApi(): EventsApi {
  return {
    async list() {
      const { eventId, slug, activityId, phase, startAt, startDtm, endAt, endDtm, card } =
        buildMockDetail();
      return [{ eventId, slug, activityId, phase, startAt, startDtm, endAt, endDtm, card }];
    },
    async get(slug) {
      return slug === "take-four" ? buildMockDetail() : null;
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
  if (baseUrl) return createEventsApi(baseUrl);
  return nodeEnv === "production" ? createEmptyEventsApi() : createMockEventsApi();
}

/** 커머스 `api`의 mock/http 모드와 별개 — 주소가 있으면 http, 없으면 mock(운영은 빈 응답). */
export const eventsApi: EventsApi = selectEventsApi(
  process.env.NEXT_PUBLIC_API_BASE_URL,
  process.env.NODE_ENV,
);

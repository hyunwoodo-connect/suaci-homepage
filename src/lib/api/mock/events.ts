import type { EventDetail } from "@/types";

import type { EventsApi } from "../events";

const DAY = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 대역 이벤트마다 다른 것. 기간은 늘 '어제 열어 30일 뒤 닫는' live 다 */
type MockEvent = Pick<EventDetail, "eventId" | "slug" | "activityId" | "card" | "copy">;

const MOCK_EVENTS: MockEvent[] = [
  {
    eventId: "no01",
    slug: "take-four",
    activityId: "take-four",
    card: { title: "take four", summary: "네 컷으로 남기는 take suaci.", order: 1 },
    copy: {
      upcoming: "곧 문을 열어요.",
      live: "지금 네 컷을 찍어보세요.",
      ended: "이벤트가 끝났어요.",
    },
  },
  {
    eventId: "teum01",
    slug: "teum",
    activityId: "teum",
    card: { title: "틈", summary: "구 모양 세계를 떠다니며 만나는 것들.", order: 2 },
    copy: {
      upcoming: "곧 문을 열어요.",
      live: "정처 없이 떠다니세요.",
      ended: "이벤트가 끝났어요.",
    },
  },
];

function buildMockDetail(base: MockEvent): EventDetail {
  const now = Date.now();
  const startAt = now - DAY;
  const endAt = now + 30 * DAY;
  const startKstMs = startAt + KST_OFFSET_MS;
  const endKstMs = endAt + KST_OFFSET_MS;
  return {
    ...base,
    phase: "live",
    startAt,
    startDtm: new Date(startKstMs).toISOString().replace("Z", "+09:00"),
    endAt,
    endDtm: new Date(endKstMs).toISOString().replace("Z", "+09:00"),
    switches: {},
    locales: ["ko"],
  };
}

/** 백엔드 주소가 없을 때(로컬 개발·테스트)의 대역. */
export function createMockEventsApi(): EventsApi {
  return {
    async list() {
      return MOCK_EVENTS.map((base) => {
        const { eventId, slug, activityId, phase, startAt, startDtm, endAt, endDtm, card } =
          buildMockDetail(base);
        return { eventId, slug, activityId, phase, startAt, startDtm, endAt, endDtm, card };
      });
    },
    async get(slug) {
      const base = MOCK_EVENTS.find((e) => e.slug === slug);
      return base ? buildMockDetail(base) : null;
    },
  };
}

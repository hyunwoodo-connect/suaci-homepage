import type { EventDetail } from "@/types";

import type { EventsApi } from "../events";

const DAY = 24 * 60 * 60 * 1000;

function buildMockDetail(): EventDetail {
  const now = Date.now();
  return {
    eventId: "no01",
    slug: "take-four",
    activityId: "take-four",
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

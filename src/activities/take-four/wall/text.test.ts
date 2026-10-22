import { describe, it, expect } from "vitest";

import type { EventDetail } from "@/types";

import type { StripView } from "./api";
import { wallCaption, wallNotice } from "./text";

// KST 2026-12-01 00:00 ~ 2027-01-10 23:59:59, 발표 2027-01-15 10:00
const START = Date.parse("2026-11-30T15:00:00Z");
const END = Date.parse("2027-01-10T14:59:59Z");
const ANNOUNCE = Date.parse("2027-01-15T01:00:00Z");

function event(phase: EventDetail["phase"], extra: Partial<EventDetail> = {}): EventDetail {
  return {
    eventId: "no01",
    slug: "take-four",
    activityId: "take-four",
    phase,
    startAt: START,
    startDtm: "",
    endAt: END,
    endDtm: "",
    announceAt: ANNOUNCE,
    card: { title: "take four", summary: "", order: 1 },
    copy: {},
    switches: {},
    locales: ["ko"],
    ...extra,
  };
}

function strip(extra: Partial<StripView> = {}): StripView {
  return {
    id: "01J",
    serial: 347,
    eventId: "no01",
    ribbons: 0,
    thumbUrl: "https://cdn/thumb.jpg",
    photoUrl: "https://cdn/original.jpg",
    // KST 12.04 09:00
    postedAt: Date.parse("2026-12-04T00:00:00Z"),
    postedDtm: "",
    ...extra,
  };
}

describe("wallCaption", () => {
  it("이벤트 네컷 → 4자리 번호, 회차·KST 날짜, 도장", () => {
    expect(wallCaption(strip())).toEqual({
      number: "no.0347",
      meta: "No.01 · 12.04",
      stamp: "No.01",
    });
  });

  it("이벤트 없는 네컷 → 번호만(meta·도장 없음)", () => {
    expect(wallCaption(strip({ eventId: null }))).toEqual({
      number: "no.0347",
      meta: "",
      stamp: undefined,
    });
  });

  it("내용이 없는 이벤트 id → meta·도장 없음", () => {
    expect(wallCaption(strip({ eventId: "zz" })).meta).toBe("");
  });
});

describe("wallNotice", () => {
  it("열기 전 → 시작 날짜", () => {
    expect(wallNotice(event("upcoming"), START - 1)).toEqual({
      head: "No.01 · 12.01 시작",
      body: "100장을 골라요",
    });
  });

  it("진행 중 → 기간", () => {
    expect(wallNotice(event("live"), START)).toEqual({
      head: "No.01 · 12.01 – 01.10",
      body: "100장에 suaci 첫 병을 보내요",
    });
  });

  it("마감 → 발표일에 연락", () => {
    expect(wallNotice(event("ended"), END + 1)).toEqual({
      head: "No.01 · 응모 끝",
      body: "1월 15일에 연락드려요",
    });
  });

  it("발표 뒤 → 고마워요", () => {
    expect(wallNotice(event("ended"), ANNOUNCE)).toEqual({
      head: "No.01 · 발표 끝",
      body: "함께해 줘서 고마워요",
    });
  });

  it("이벤트 내용이 없으면 → null", () => {
    expect(wallNotice(event("live", { eventId: "zz" }), START)).toBeNull();
  });
});

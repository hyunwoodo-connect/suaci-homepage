import { describe, it, expect } from "vitest";

import { getEventContent } from "@/events";
import type { EventDetail } from "@/types";

import { infoPhase, infoView } from "./info";

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

const NO01 = getEventContent("no01");

describe("infoPhase", () => {
  it("upcoming·live는 레코드 그대로", () => {
    expect(infoPhase(event("upcoming"), START - 1)).toBe("upcoming");
    expect(infoPhase(event("live"), START)).toBe("live");
  });

  it("ended + 발표 전 → ended, 발표 시각부터 → announced", () => {
    expect(infoPhase(event("ended"), ANNOUNCE - 1)).toBe("ended");
    expect(infoPhase(event("ended"), ANNOUNCE)).toBe("announced");
  });

  it("발표일이 없는 이벤트 → 계속 ended", () => {
    expect(infoPhase(event("ended", { announceAt: undefined }), ANNOUNCE * 2)).toBe("ended");
  });
});

describe("infoView", () => {
  it.each([
    [
      "upcoming",
      START - 1,
      "12.01 open",
      "12월 1일에 시작해요.\n부스는 지금도 열려 있어요.",
      "먼저 찍어 보기",
    ],
    ["live", START + 1, "12.01 – 01.10", "네컷 100장을 골라요.", "찍으러 가기"],
    ["ended", END + 1, "closed", "응모는 끝났어요.\n1월 15일에 연락드려요.", "그냥 찍기"],
    ["ended", ANNOUNCE, "01.15", "100명에게 연락드렸어요.\n함께해 줘서 고마워요.", "그냥 찍기"],
  ] as const)("%s(%d) 레코드 copy 없음 → 시안 문구", (phase, now, stamp, headline, cta) => {
    const view = infoView(event(phase), NO01, now);
    expect(view).toMatchObject({ stamp, headline, cta });
  });

  it("레코드 copy가 있으면 → 그 phase 문구가 먼저", () => {
    const copy = { live: "지금 찍어서 응모해요.", announced: "발표했어요." };
    expect(infoView(event("live", { copy }), NO01, START + 1).headline).toBe(
      "지금 찍어서 응모해요.",
    );
    expect(infoView(event("ended", { copy }), NO01, ANNOUNCE).headline).toBe("발표했어요.");
  });

  it("레코드 copy가 빈칸뿐 → 시안 문구", () => {
    expect(infoView(event("live", { copy: { live: "  " } }), NO01, START).headline).toBe(
      "네컷 100장을 골라요.",
    );
  });

  it("기간·발표일은 KST `M월 D일`(UTC로는 전날이어도)", () => {
    const view = infoView(event("live"), NO01, START);
    expect(view.period).toBe("12월 1일 – 1월 10일");
    expect(view.announce).toBe("1월 15일");
  });

  it("받는 것·제목은 이벤트 내용(No.01)에서", () => {
    const view = infoView(event("live"), NO01, START);
    expect(view.reward).toBe("suaci 첫 병과 인화한 내 네컷");
    expect(view.title).toBe("No.01");
  });

  it("이벤트 내용이 없는 이벤트 → 받는 것 없음, 제목은 카드 제목, 문구는 레코드만", () => {
    const view = infoView(event("live", { eventId: "x" }), getEventContent("x"), START);
    expect(view).toMatchObject({ reward: null, title: "take four", headline: "" });
  });

  it("발표일 없음 → 발표 줄 없음, 마감 문구도 날짜 없이", () => {
    const view = infoView(event("ended", { announceAt: undefined }), NO01, END + 1);
    expect(view.announce).toBeNull();
    expect(view.headline).toBe("응모는 끝났어요.");
  });
});

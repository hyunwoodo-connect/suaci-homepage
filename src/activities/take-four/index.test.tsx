import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { EventDetail } from "@/types";

import { TAKE_FOUR } from ".";

const EVENT = {
  eventId: "no01",
  slug: "take-four",
  activityId: "take-four",
  phase: "live",
  startAt: 0,
  endAt: 0,
  card: { title: "take four", summary: "", order: 1 },
  copy: {},
  switches: {},
} as unknown as EventDetail;
const CTX = { userAgent: "", url: "https://takesuaci.com/events/take-four" };

describe("TAKE_FOUR.route", () => {
  it("booth → 부스(셔터)", () => {
    const screen = TAKE_FOUR.route(["booth"], EVENT, CTX);
    expect(renderToStaticMarkup(<>{screen}</>)).toContain("찍기 시작");
  });

  it("result → 마지막 띠 화면", () => {
    expect(TAKE_FOUR.route(["result"], EVENT, CTX)).not.toBeNull();
  });

  it.each([
    ["album", "넉 장 골라 주세요"],
    ["no-camera", "앨범에서 넉 장 고르기"],
    ["info", "No.01"],
  ])("%s → 그 화면(%s)", (path, text) => {
    const screen = TAKE_FOUR.route([path], EVENT, CTX);
    expect(renderToStaticMarkup(<>{screen}</>)).toContain(text);
  });

  it("모르는 경로 → null", () => {
    expect(TAKE_FOUR.route(["nope"], EVENT, CTX)).toBeNull();
  });

  it("wall 스위치가 꺼졌으면 wall·wall/{stripId} → null(404)", () => {
    expect(TAKE_FOUR.route(["wall"], EVENT, CTX)).toBeNull();
    expect(TAKE_FOUR.route(["wall", "01J"], EVENT, CTX)).toBeNull();
  });

  it("wall 스위치가 켜졌으면 wall → 벽, wall/{stripId} → 크게 보기", () => {
    const on = { ...EVENT, switches: { wall: true } };
    expect(renderToStaticMarkup(<>{TAKE_FOUR.route(["wall"], on, CTX)}</>)).toContain("the wall");
    expect(renderToStaticMarkup(<>{TAKE_FOUR.route(["wall", "01J"], on, CTX)}</>)).toContain(
      "불러오는 중…",
    );
  });

  it("wall 아래 더 깊은 경로 → null", () => {
    const on = { ...EVENT, switches: { wall: true } };
    expect(TAKE_FOUR.route(["wall", "01J", "x"], on, CTX)).toBeNull();
    expect(TAKE_FOUR.route(["booth", "01J"], on, CTX)).toBeNull();
  });

  it("더 깊은 경로 → null", () => {
    expect(TAKE_FOUR.route(["booth", "x"], EVENT, CTX)).toBeNull();
  });
});

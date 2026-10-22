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
  it("booth → 부스(찰칵)", () => {
    const screen = TAKE_FOUR.route(["booth"], EVENT, CTX);
    expect(renderToStaticMarkup(<>{screen}</>)).toContain("찰칵");
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
    expect(TAKE_FOUR.route(["wall"], EVENT, CTX)).toBeNull();
  });

  it("더 깊은 경로 → null", () => {
    expect(TAKE_FOUR.route(["booth", "x"], EVENT, CTX)).toBeNull();
  });
});

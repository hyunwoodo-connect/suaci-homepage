import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { EventDetail } from "@/types";

import { TAKE_FOUR } from ".";

const EVENT = { slug: "take-four", activityId: "take-four" } as EventDetail;

describe("TAKE_FOUR.route", () => {
  it("booth → 부스(찰칵)", () => {
    const screen = TAKE_FOUR.route(["booth"], EVENT);
    expect(renderToStaticMarkup(<>{screen}</>)).toContain("찰칵");
  });

  it.each(["album", "no-camera", "info"])("%s → 화면을 그린다", (path) => {
    const screen = TAKE_FOUR.route([path], EVENT);
    expect(screen).not.toBeNull();
    expect(renderToStaticMarkup(<>{screen}</>)).toContain("준비 중이에요");
  });

  it("모르는 경로 → null", () => {
    expect(TAKE_FOUR.route(["wall"], EVENT)).toBeNull();
  });

  it("더 깊은 경로 → null", () => {
    expect(TAKE_FOUR.route(["booth", "x"], EVENT)).toBeNull();
  });
});

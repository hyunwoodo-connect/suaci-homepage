import { describe, expect, it } from "vitest";

import { duskAt } from "./sunset";
import { HIDE } from "./tuning";

describe("duskAt", () => {
  const { seconds, redFrom } = HIDE.round;

  it("판 시작 → 낮, 판 끝 → 해가 졌다(그 뒤로도 1)", () => {
    expect(duskAt(0)).toBe(0);
    expect(duskAt(seconds)).toBe(1);
    expect(duskAt(seconds + 30)).toBe(1);
  });

  it("redFrom 까지는 은은하게, 그 뒤로 더 빨리 붉어진다", () => {
    const early = duskAt(redFrom) / redFrom,
      late = (1 - duskAt(redFrom)) / (seconds - redFrom);
    expect(duskAt(redFrom)).toBeLessThan(0.5);
    expect(late).toBeGreaterThan(early);
  });
});

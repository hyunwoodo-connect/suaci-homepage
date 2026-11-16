import { describe, expect, it } from "vitest";

import { tripSeconds } from "./guide";
import { HIDE } from "./tuning";

describe("tripSeconds", () => {
  const { stop, speed, minSeconds, maxSeconds } = HIDE.guide;

  it("가까운 상자 → 가장 짧은 시간(minSeconds)을 들여 천천히 간다", () => {
    expect(tripSeconds(stop + 6)).toBe(minSeconds);
  });

  it("중간 거리 → 정한 빠르기로 간다", () => {
    const travel = (minSeconds + maxSeconds) * 0.5 * speed;
    expect(tripSeconds(stop + travel)).toBeCloseTo((minSeconds + maxSeconds) * 0.5, 5);
  });

  it("먼 상자 → 가장 긴 시간(maxSeconds)을 넘기지 않는다", () => {
    expect(tripSeconds(stop + 400)).toBe(maxSeconds);
  });

  it("상자가 바로 앞(멈출 거리 안) → 데려가지 않고 돌려세우기만 한다", () => {
    expect(tripSeconds(stop + 0.5)).toBeLessThan(minSeconds);
    expect(tripSeconds(stop - 3)).toBeLessThan(minSeconds);
  });
});

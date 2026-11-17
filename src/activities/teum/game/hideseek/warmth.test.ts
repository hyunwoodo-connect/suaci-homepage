import { describe, expect, it } from "vitest";

import { FIND } from "./findTuning";
import { giggleEvery, giggleRate, giggleVolume, warmthOf } from "./warmth";

describe("뜨거워 차가워", () => {
  it("거리 → 단계: 40m 밖 없음 · 40~20m · 20~8m · 8m 안", () => {
    expect(warmthOf(55)).toBe(0);
    expect(warmthOf(40.1)).toBe(0);
    expect(warmthOf(39)).toBe(1);
    expect(warmthOf(20.1)).toBe(1);
    expect(warmthOf(19)).toBe(2);
    expect(warmthOf(8.1)).toBe(2);
    expect(warmthOf(7.9)).toBe(3);
    expect(warmthOf(0)).toBe(3);
  });

  it("단계 → 키득 간격: 가까울수록 짧다(6초 · 3초 · 1.2초), 멀면 없다", () => {
    expect(giggleEvery(0)).toBeNull();
    expect(giggleEvery(1)).toBe(6);
    expect(giggleEvery(2)).toBe(3);
    expect(giggleEvery(3)).toBe(1.2);
  });

  it("키득 크기: 40m 에서 30%, 8m 안에서 100%, 그 사이는 가까울수록 크다", () => {
    expect(giggleVolume(FIND.warm.far)).toBeCloseTo(0.3);
    expect(giggleVolume(FIND.warm.near)).toBeCloseTo(1);
    expect(giggleVolume(3)).toBeCloseTo(1);
    expect(giggleVolume(24)).toBeGreaterThan(giggleVolume(30));
  });

  it("음높이: ±2반음 안", () => {
    const low = giggleRate(0),
      high = giggleRate(1);
    expect(low).toBeCloseTo(Math.pow(2, -2 / 12));
    expect(high).toBeCloseTo(Math.pow(2, 2 / 12));
    expect(giggleRate(0.5)).toBeCloseTo(1);
  });
});

import { describe, expect, it } from "vitest";

import { leapSeconds } from "./leap";
import { HIDE } from "./tuning";

describe("leapSeconds", () => {
  const { leapMin, leapMax, tapReach } = HIDE.find;

  it("바로 앞 → 가장 짧게(leapMin)", () => {
    expect(leapSeconds(0)).toBeCloseTo(leapMin, 5);
  });

  it("찾는 거리 끝(tapReach) → 가장 길게(leapMax)", () => {
    expect(leapSeconds(tapReach)).toBeCloseTo(leapMax, 5);
  });

  it("더 멀어도(버섯 위에서) → leapMax 를 넘지 않는다", () => {
    expect(leapSeconds(tapReach * 2)).toBeCloseTo(leapMax, 5);
  });
});

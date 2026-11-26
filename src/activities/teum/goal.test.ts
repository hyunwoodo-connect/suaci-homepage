import { describe, expect, it } from "vitest";

import { TEUM_GOAL } from "./goal";
import { DEFAULT_MAP } from "./game/maps";

describe("TEUM_GOAL", () => {
  it("시작 화면의 물풍선 수 → 기본 지도의 물풍선 수와 같다", () => {
    expect(TEUM_GOAL.count).toBe(DEFAULT_MAP.waterBalloons?.length);
  });
});

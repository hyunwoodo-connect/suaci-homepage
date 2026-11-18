import { describe, expect, it } from "vitest";

import { V78_MAP } from "../maps/v78";
import { roamPlan } from "./roaming";

const ROAMING = { herds: 4, flocks: 3, jellies: 2 },
  SKY = ["key", "c_wheart", "c_wletter", "c_wcup", "c_wbell"];

describe("roamPlan", () => {
  it("땅 무리가 사는 지역 → 그 지역 종을 돌려 가며, 한 마리·두 마리를 번갈아", () => {
    const region = { ...V78_MAP.regions[1], herds: ["teapot", "c_hat"] },
      plan = roamPlan(region, ROAMING, SKY);
    expect(plan.herds).toEqual([
      { key: "teapot", count: 1 },
      { key: "c_hat", count: 2 },
      { key: "teapot", count: 1 },
      { key: "c_hat", count: 2 },
    ]);
  });

  it("땅 무리가 없는 지역(하늘 마을) → 땅 무리 없이 그 지역에 사는 하늘 종만", () => {
    const region = { ...V78_MAP.regions[4], residents: ["c_wbell", "key"] },
      plan = roamPlan(region, ROAMING, SKY);
    expect(plan.herds).toEqual([]);
    expect(plan.flocks).toEqual(["key", "c_wbell", "key"]);
  });

  it("하늘 무리가 사는데 그 지역에 사는 하늘 종이 없으면 → 하늘 종 모두를 돌려 쓴다", () => {
    const region = { ...V78_MAP.regions[4], residents: [] },
      plan = roamPlan(region, ROAMING, SKY);
    expect(plan.flocks).toEqual(["key", "c_wheart", "c_wletter"]);
  });

  it("해파리는 해파리가 사는 지역에만", () => {
    expect(roamPlan(V78_MAP.regions[5], ROAMING, SKY).jellies).toBe(2);
    expect(roamPlan(V78_MAP.regions[0], ROAMING, SKY).jellies).toBe(0);
  });

  it("v78: 여섯 지역 모두 떠도는 무리가 있다(어디를 가도 손님을 만난다)", () => {
    const roaming = V78_MAP.creatures.roaming;
    for (const region of V78_MAP.regions) {
      const plan = roamPlan(region, roaming, SKY),
        size = plan.herds.length + plan.flocks.length + plan.jellies;
      expect(size, region.name).toBeGreaterThan(0);
    }
  });
});

import { describe, expect, it } from "vitest";

import { bareOf } from "./bare";
import { V79_MAP } from "./v79";

describe("bareOf(맵만 보기)", () => {
  const bare = bareOf(V79_MAP);

  it("별·나무·쉬는 곳 → 뺀다, 놀이기구·랜드마크·장소 → 그대로", () => {
    expect(bare.layout.star).toEqual([]);
    expect(bare.layout.tree).toEqual([]);
    expect(bare.layout.site.some((st) => st.kind === "rest")).toBe(false);
    expect(bare.layout.site.length).toBeGreaterThan(0);
    expect(bare.layout.cannon).toBe(V79_MAP.layout.cannon);
    expect(bare.layout.landmark).toBe(V79_MAP.layout.landmark);
    expect(bare.layout.place).toBe(V79_MAP.layout.place);
  });

  it("생물·조형물·꽃 → 하나도 놓지 않는다", () => {
    for (const r of bare.regions) {
      expect(r.residents).toEqual([]);
      expect(r.big).toEqual([]);
      expect(r.tree).toBeNull();
    }
    expect(bare.creatures.legends).toEqual({});
    expect(bare.creatures.seaSwimmers).toBe(0);
    expect(bare.terrain.flowers).toBe(0);
    expect(bare.bigFlowers.perHub).toBe(0);
  });
});

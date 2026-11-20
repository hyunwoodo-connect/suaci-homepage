import { describe, expect, it } from "vitest";

import { Random } from "../core/random";
import { pickSpots } from "./props";
import { placeSpots, SPOT_SPECS } from "./spots";
import { StandShape } from "./stand";
import { TEA } from "./teaTuning";

const spots = placeSpots(new StandShape(TEA), SPOT_SPECS);

describe("pickSpots(기획서 v3.1 6장)", () => {
  it("층마다 셋, 같은 층에 같은 종류는 둘까지 — 씨앗 100개", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const picked = pickSpots(spots, new Random(seed));
      expect(picked).toHaveLength(12);
      for (const tier of [0, 1, 2, 3]) {
        const onTier = picked.filter((s) => s.tier === tier);
        expect(onTier).toHaveLength(3);
        const kinds = onTier.map((s) => s.kind);
        for (const k of kinds) expect(kinds.filter((x) => x === k).length).toBeLessThanOrEqual(2);
      }
    }
  });

  it("같은 씨앗 → 같은 배치", () => {
    const a = pickSpots(spots, new Random(42)).map((s) => s.index);
    const b = pickSpots(spots, new Random(42)).map((s) => s.index);
    expect(a).toEqual(b);
  });
});

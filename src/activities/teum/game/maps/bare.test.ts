import { describe, expect, it } from "vitest";

import { bareOf } from "./bare";
import { V79_MAP } from "./v79";

describe("bareOf(꾸밈은 자리표만)", () => {
  const bare = bareOf(V79_MAP);

  it("자리표 → 그대로(꾸밈·놀이기구·쉼터·장소·랜드마크)", () => {
    expect(bare.layout).toBe(V79_MAP.layout);
  });

  it("지역이 흩뿌리는 조형물·나무·꽃·생물 → 하나도 놓지 않는다", () => {
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

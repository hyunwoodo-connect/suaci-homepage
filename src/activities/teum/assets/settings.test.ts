import { describe, expect, it } from "vitest";

import { CREATURES, MODEL_TINT, herdSpecies, sculptureKeys } from "./settings";

describe("herdSpecies", () => {
  it("무리로 나오는 생물 → 시제품 순서(찻주전자부터 컵케이크까지)", () => {
    expect(herdSpecies().map((s) => s.key)).toEqual([
      "teapot",
      "c_watch",
      "card",
      "c_hat",
      "mushroom",
      "c_rose",
      "brabbit",
      "c_dice",
      "c_cupcake",
    ]);
  });

  it("무리 설정 → 크기·걸음·마릿수 그대로", () => {
    expect(herdSpecies()[2]).toEqual({ key: "card", size: 2.8, gait: "walk", count: 4 });
  });
});

describe("sculptureKeys", () => {
  it("작은 것 → 여섯 가지, 고르는 순서 그대로", () => {
    expect(sculptureKeys("small")).toEqual([
      "d_cake",
      "d_macaron",
      "d_teacup",
      "d_fruitpile",
      "d_smileflower",
      "d_flowerpile",
    ]);
  });

  it("큰 것 → 열두 가지, 체스 탑부터 팽이까지", () => {
    const large = sculptureKeys("large");
    expect(large).toHaveLength(12);
    expect([large[0], large[11]]).toEqual(["s_rook", "s_top"]);
  });
});

describe("설정 표", () => {
  it("체스 탑 색조 → 분홍을 0.7 만큼(회색이 된 체커를 덮는다)", () => {
    expect(MODEL_TINT.s_rook).toEqual([0xff4f9a, 0.7]);
  });

  it("주사위 → 걷지 않고 구른다(무리 걸음 walk, 버릇 roll)", () => {
    expect(CREATURES.c_dice.herd?.gait).toBe("walk");
    expect(CREATURES.c_dice.habit).toBe("roll");
  });

  it("날개 하트·날개 왕관만 → 다가오면 내 둘레를 돈다", () => {
    const orbiting = Object.keys(CREATURES).filter((k) => CREATURES[k].orbits);
    expect(orbiting).toEqual(["c_wheart", "c_wcrown"]);
  });

  it("버섯 → 기운 것을 바로 세우는 돌림", () => {
    expect(CREATURES.mushroom.bake).toEqual([0, 0, -0.42]);
  });
});

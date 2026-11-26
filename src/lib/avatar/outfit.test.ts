import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOOK,
  LOOK_TABS,
  lookAssetKeys,
  optionsFor,
  randomLook,
  readLook,
  STUDIO_BG,
} from "./outfit";
import { PARTS } from "./parts";

describe("optionsFor", () => {
  it("소품 탭 → '없음'과 그 칸의 부품만, 머리는 맨머리가 없다", () => {
    expect(optionsFor("hand")).toEqual(["", "bouquet", "bag"]);
    expect(optionsFor("hair")).toEqual(["hair_bob", "scarf"]);
  });

  it("치마 → 기본·무늬·단색, 신발 → 기본·색", () => {
    expect(optionsFor("bot")).toContain("rose");
    expect(optionsFor("bot")).toContain("#ff8fbd");
    expect(optionsFor("shoe")[0]).toBe("");
    expect(optionsFor("shoe")).not.toContain("rose");
  });

  it("모든 부품 → 어느 한 탭에 나온다", () => {
    const all = LOOK_TABS.flatMap((t) => optionsFor(t));
    for (const k of Object.keys(PARTS)) expect(all, k).toContain(k);
  });
});

describe("randomLook", () => {
  it("어떤 난수든 → 탭마다 고를 수 있는 값", () => {
    for (const r of [0, 0.5, 0.999999]) {
      const look = randomLook(() => r, new Map());
      for (const t of LOOK_TABS) expect(optionsFor(t), t).toContain(look[t]);
    }
  });

  it("아직 받지 못한 것 → 어떤 난수에도 고르지 않는다", () => {
    const locks = new Map([["board", "틈"]]);
    for (const r of [0, 0.5, 0.999999]) expect(randomLook(() => r, locks).board).toBe("");
  });

  it("받지 못한 것이 있어도 → 다른 탭의 결과는 그대로다(난수를 탭마다 한 번씩 쓴다)", () => {
    const rolls = [0.1, 0.9, 0.4, 0.7, 0.2, 0.6, 0.8, 0.95];
    const roller = () => {
      let at = 0;
      return () => rolls[at++ % rolls.length];
    };
    const open = randomLook(roller(), new Map()),
      locked = randomLook(roller(), new Map([["board", "틈"]]));
    expect({ ...locked, board: open.board }).toEqual(open);
  });
});

describe("readLook", () => {
  it("표에 없는 값·다른 칸의 부품·빈 머리 → 그 탭만 기본", () => {
    const look = readLook({
      top: "rose",
      bot: "#123456",
      hand: "scarf",
      hair: "",
      shoe: "#a9ff39",
    });
    expect(look).toEqual({ ...DEFAULT_LOOK, top: "rose", shoe: "#a9ff39" });
  });

  it("객체가 아니면 → 처음 차림", () => {
    expect(readLook("x")).toEqual(DEFAULT_LOOK);
  });
});

describe("lookAssetKeys", () => {
  it("끼운 부품과 입은 무늬의 에셋 키, 단색·기본은 받을 것이 없다", () => {
    const look = { ...DEFAULT_LOOK, top: "daisy", bot: "#2b2e2d", ear: "earring" };
    expect(lookAssetKeys(look)).toEqual(["hair_bob", "glass_heart", "earring", "print_daisy"]);
  });
});

describe("STUDIO_BG", () => {
  it("윗옷 무늬마다 배경색이 있다", () => {
    for (const top of optionsFor("top")) expect(STUDIO_BG[top], top).toMatch(/^#[0-9a-f]{6}$/);
  });
});

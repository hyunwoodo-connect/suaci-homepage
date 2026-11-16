import { describe, expect, it } from "vitest";

import { Random } from "../core/random";
import { HIDE } from "./tuning";
import { dealContents } from "./unbox";

const { duds: DUDS, happenings: HAPPENINGS } = HIDE.unbox;

describe("dealContents", () => {
  it("어느 씨앗이든 → 다섯 개, 꽝은 많아야 둘, 마지막(보너스)은 꽝이 아니다", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = new Random(seed);
      const contents = dealContents(() => rng.next());
      expect(contents).toHaveLength(5);
      const duds = contents.filter((c) => DUDS.includes(c));
      expect(duds.length, String(seed)).toBeLessThanOrEqual(2);
      expect(HAPPENINGS, String(seed)).toContain(contents[4]);
    }
  });

  it("여러 판 → 다섯 가지 내용물이 모두 나온다", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const rng = new Random(seed);
      for (const c of dealContents(() => rng.next())) seen.add(c);
    }
    expect([...seen].sort()).toEqual(["bubbles", "giant", "lime", "nested", "whale"]);
  });
});

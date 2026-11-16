import { describe, expect, it } from "vitest";

import { Random } from "../core/random";
import { HIDE } from "./tuning";
import { dealContents } from "./unbox";

const { duds: DUDS, happenings: HAPPENINGS, dudCount } = HIDE.unbox;

// 씨앗마다 한 번씩 나눠 본다
function deals(found: number, hasBonus: boolean) {
  return Array.from({ length: 200 }, (_, i) => {
    const rng = new Random(i + 1);
    return dealContents(found, hasBonus, () => rng.next());
  });
}

describe("dealContents", () => {
  it("넷을 다 찾았다 → 다섯 개, 마지막(보너스)은 꽝이 아니다", () => {
    for (const contents of deals(4, true)) {
      expect(contents).toHaveLength(5);
      expect(HAPPENINGS).toContain(contents[4]);
    }
  });

  it("꽝 → 한 판에 dudCount 개(지금 둘)를 넘지 않는다", () => {
    for (const contents of deals(4, true))
      expect(contents.filter((c) => DUDS.includes(c))).toHaveLength(dudCount);
  });

  it("하나만 찾고 졌다 → 그 상자는 꽝이 아니다", () => {
    for (const contents of deals(1, false)) {
      expect(contents).toHaveLength(1);
      expect(HAPPENINGS).toContain(contents[0]);
    }
  });

  it("둘·셋을 찾고 졌다 → 꽝은 찾은 상자의 절반까지만(하나)", () => {
    for (const found of [2, 3])
      for (const contents of deals(found, false))
        expect(contents.filter((c) => DUDS.includes(c))).toHaveLength(1);
  });

  it("해가 져서 찾은 것만 깐다 → 찾은 수만큼이고 보너스가 없다", () => {
    for (const contents of deals(3, false)) expect(contents).toHaveLength(3);
    expect(dealContents(0, false, () => 0.5)).toEqual([]);
  });

  it("여러 판 → 다섯 가지 내용물이 모두 나온다", () => {
    const seen = new Set<string>();
    for (const contents of deals(4, true)) for (const c of contents) seen.add(c);
    expect([...seen].sort()).toEqual(["bubbles", "giant", "lime", "nested", "whale"]);
  });
});

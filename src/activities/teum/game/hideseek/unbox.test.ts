import { describe, expect, it } from "vitest";

import { Random } from "../core/random";
import { HIDE } from "./tuning";
import type { BoxFavor } from "./unbox";
import { dealContents } from "./unbox";

const { duds: DUDS, happenings: HAPPENINGS, dudCount } = HIDE.unbox;

// 씨앗마다 한 번씩 나눠 본다
function deals(favors: BoxFavor[], hasBonus: boolean) {
  return Array.from({ length: 200 }, (_, i) => {
    const rng = new Random(i + 1);
    return dealContents(favors, hasBonus, () => rng.next());
  });
}

describe("dealContents", () => {
  it("넷을 다 찾았다 → 다섯 개, 마지막(보너스)은 꽝이 아니다", () => {
    for (const contents of deals(["helped", "helped", "helped", "helped"], true)) {
      expect(contents).toHaveLength(5);
      expect(HAPPENINGS).toContain(contents[4]);
    }
  });

  it("도움받아 찾은 상자 → 꽝은 한 판에 dudCount 개(지금 둘)를 넘지 않는다", () => {
    for (const contents of deals(["helped", "helped", "helped", "helped"], true))
      expect(contents.filter((c) => DUDS.includes(c))).toHaveLength(dudCount);
  });

  it("눈으로만 찾은 상자 → 꽝이 나오지 않는다", () => {
    for (const contents of deals(["eyes", "helped", "eyes", "helped"], true)) {
      expect(HAPPENINGS).toContain(contents[0]);
      expect(HAPPENINGS).toContain(contents[2]);
    }
    for (const contents of deals(["eyes", "eyes", "eyes", "eyes"], true))
      expect(contents.filter((c) => DUDS.includes(c))).toHaveLength(0);
  });

  it("'못 찾겠다'로 찾은 상자 → 꽝 확정이고, 그만큼 다른 상자의 꽝이 준다", () => {
    for (const contents of deals(["gaveUp", "helped", "helped", "gaveUp"], true)) {
      expect(DUDS).toContain(contents[0]);
      expect(DUDS).toContain(contents[3]);
      expect(HAPPENINGS).toContain(contents[1]);
      expect(HAPPENINGS).toContain(contents[2]);
    }
  });

  it("해가 져서 찾은 것만 깐다 → 찾은 수만큼이고 보너스가 없다", () => {
    for (const contents of deals(["eyes", "helped"], false)) expect(contents).toHaveLength(2);
    expect(dealContents([], false, () => 0.5)).toEqual([]);
  });

  it("여러 판 → 다섯 가지 내용물이 모두 나온다", () => {
    const seen = new Set<string>();
    for (const contents of deals(["helped", "helped", "helped", "helped"], true))
      for (const c of contents) seen.add(c);
    expect([...seen].sort()).toEqual(["bubbles", "giant", "lime", "nested", "whale"]);
  });
});

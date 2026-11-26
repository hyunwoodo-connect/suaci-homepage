import { describe, expect, it } from "vitest";

import type { BoxPlan } from "./prize-box";
import { PRIZES_KEY, drawBoxes, keepPrizes, lockedPrizes } from "./prize-box";

const PLAN: BoxPlan = {
  eventId: "e1",
  from: "틈",
  count: 3,
  pool: [
    { prize: { kind: "item", item: "a" }, weight: 1 },
    { prize: { kind: "item", item: "b" }, weight: 1 },
    { prize: { kind: "item", item: "c" }, weight: 1 },
  ],
};

/** 늘 같은 값을 주는 난수 */
const fixed = (v: number) => () => v;

describe("drawBoxes", () => {
  it("박스 수만큼 → 한 판에서 같은 것이 두 번 나오지 않는다", () => {
    const items = drawBoxes(PLAN, fixed(0)).map((p) => (p.kind === "item" ? p.item : "mist"));
    expect(items).toEqual(["a", "b", "c"]);
  });

  it("이미 가진 것 → 없는 것부터 나온다", () => {
    keepPrizes([{ kind: "item", item: "a" }]);
    const first = drawBoxes({ ...PLAN, count: 1 }, fixed(0))[0];
    expect(first).toEqual({ kind: "item", item: "b" });
  });

  it("다 가졌으면 → 풀 전체에서 고른다(빈손이 없다)", () => {
    keepPrizes(PLAN.pool.map((s) => s.prize));
    expect(drawBoxes(PLAN, fixed(0.99))).toHaveLength(3);
  });

  it("무게 → 무거운 칸이 더 넓다", () => {
    const plan: BoxPlan = {
      ...PLAN,
      count: 1,
      pool: [
        { prize: { kind: "item", item: "a" }, weight: 1 },
        { prize: { kind: "item", item: "b" }, weight: 9 },
      ],
    };
    expect(drawBoxes(plan, fixed(0.2))[0]).toEqual({ kind: "item", item: "b" });
  });
});

describe("keepPrizes · lockedPrizes", () => {
  it("받기 전 → 풀의 옷장 칸이 모두 잠기고 받는 곳 이름이 붙는다", () => {
    expect([...lockedPrizes([PLAN])]).toEqual([
      ["a", "틈"],
      ["b", "틈"],
      ["c", "틈"],
    ]);
  });

  it("받으면 → 그 칸만 풀린다(미스트는 옷장과 상관없다)", () => {
    keepPrizes([{ kind: "item", item: "b" }, { kind: "mist" }]);
    expect([...lockedPrizes([PLAN]).keys()]).toEqual(["a", "c"]);
  });

  it("깨진 기록 → 받은 것이 없는 것으로 본다", () => {
    localStorage.setItem(PRIZES_KEY, "{");
    expect(lockedPrizes([PLAN]).size).toBe(3);
  });
});

import { describe, expect, it } from "vitest";

import { closetLabels } from "@/lib/avatar/closet-labels";
import { LOOK_TABS, optionsFor } from "@/lib/avatar/outfit";

import { getBoxPlan, listBoxPlans } from "./boxes";

describe("listBoxPlans", () => {
  it("박스의 옷장 칸은 모두 옷장에 있는 것이고 이름이 있다(없는 키면 잠긴 칸도 받은 옷도 보이지 않는다)", () => {
    const inCloset = LOOK_TABS.flatMap((tab) => optionsFor(tab));
    for (const plan of listBoxPlans()) {
      for (const { prize } of plan.pool) {
        if (prize.kind !== "item") continue;
        expect(inCloset, plan.eventId).toContain(prize.item);
        expect(closetLabels("ko").options[prize.item], prize.item).toBeTruthy();
      }
    }
  });

  it("같은 옷장 칸을 두 이벤트가 주지 않는다(어디서 받는지가 하나여야 한다)", () => {
    const items = listBoxPlans().flatMap((plan) =>
      plan.pool.flatMap(({ prize }) => (prize.kind === "item" ? [prize.item] : [])),
    );
    expect(new Set(items).size).toBe(items.length);
  });

  it("박스 수 → 하나 이상", () => {
    expect(listBoxPlans().every((plan) => plan.count >= 1)).toBe(true);
  });
});

describe("getBoxPlan", () => {
  it("틈 → 박스 3개", () => {
    expect(getBoxPlan("teum01")?.count).toBe(3);
  });

  it("박스가 없는 이벤트 → 없다", () => {
    expect(getBoxPlan("no01")).toBeUndefined();
  });
});

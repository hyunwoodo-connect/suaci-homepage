import { describe, expect, it } from "vitest";

import { closetLabels } from "@/lib/avatar/closet-labels";
import { LOOK_TABS, optionsFor } from "@/lib/avatar/outfit";

import { listEventRewards, getEventReward } from "./rewards";

describe("listEventRewards", () => {
  it("받는 옷은 모두 옷장에 있는 것이고 이름이 있다(없는 키를 주면 잠긴 칸도 받은 옷도 보이지 않는다)", () => {
    const inCloset = LOOK_TABS.flatMap((tab) => optionsFor(tab));
    for (const reward of listEventRewards()) {
      expect(inCloset, reward.eventId).toContain(reward.item);
      expect(closetLabels("ko").options[reward.item], reward.item).toBeTruthy();
    }
  });

  it("같은 옷을 두 이벤트가 주지 않는다(어디서 받는지가 하나여야 한다)", () => {
    const items = listEventRewards().map((reward) => reward.item);
    expect(new Set(items).size).toBe(items.length);
  });
});

describe("getEventReward", () => {
  it("틈 → 스케이트보드", () => {
    expect(getEventReward("teum01")?.item).toBe("board");
  });

  it("받는 옷이 없는 이벤트 → 없다", () => {
    expect(getEventReward("no01")).toBeUndefined();
  });
});

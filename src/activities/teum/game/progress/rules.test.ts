import { describe, expect, it } from "vitest";

import type { QuestContext } from "./rules";
import {
  addBox,
  collect,
  dailyBonus,
  finishQuest,
  questReady,
  stampToday,
  tellQuest,
  visitLandmark,
  weekOf,
} from "./rules";
import { emptySave } from "./save";

describe("상자·수집", () => {
  it("addBox: 다섯까지 모으고 그 뒤로는 꽝 없는 상자 수가 는다", () => {
    const save = emptySave();
    for (let i = 0; i < 7; i++) addBox(save);
    expect([save.boxes, save.sure]).toEqual([5, 2]);
  });

  it("collect: 처음 만난 종만 남고 상자 하나, 두 번째는 아무 일 없다", () => {
    const save = emptySave();
    expect([collect(save, "teapot", 10), collect(save, "teapot", 20)]).toEqual([true, false]);
    expect([save.collected.teapot.at, save.boxes]).toEqual([10, 1]);
  });
});

describe("도장·덤", () => {
  it("weekOf: 월요일에 주가 바뀐다(1970-01-05 월요일은 날짜 4)", () => {
    expect([weekOf(3), weekOf(4), weekOf(10), weekOf(11)]).toEqual([0, 1, 1, 2]);
  });

  it("stampToday: 하루 한 번, 주가 바뀌면 처음부터, 여섯을 다 모으면 꽝 없는 상자 둘", () => {
    const save = emptySave();
    const first = stampToday(save, 4);
    const again = stampToday(save, 4);
    for (let d = 5; d <= 9; d++) stampToday(save, d);
    // 도장마다 상자 하나(다섯 넘는 하나는 꽝 없는 상자로) + 여섯을 다 모아 둘
    expect([first, again, save.stamps.d.length, save.boxes, save.sure]).toEqual([
      { stamped: true, count: 1 },
      { stamped: false, count: 1 },
      6,
      5,
      3,
    ]);
    stampToday(save, 11);
    expect(save.stamps).toEqual({ w: 2, d: [11] });
  });

  it("dailyBonus: 날마다 한 번", () => {
    const save = emptySave();
    expect([dailyBonus(save, 7), dailyBonus(save, 7), dailyBonus(save, 8)]).toEqual([
      true,
      false,
      true,
    ]);
  });
});

describe("visitLandmark", () => {
  const homeOf = (k: string) => ({ teapot: 1, card: 2 })[k];

  it("처음 → 인사, 그다음은 몇 번째인지", () => {
    const save = emptySave();
    expect(visitLandmark(save, 1, 100, homeOf)).toEqual({ line: "hello", n: 1 });
    expect(visitLandmark(save, 1, 101, homeOf)).toEqual({ line: "again", n: 2 });
    expect(save.lm[1]).toEqual({ n: 2, pal: null, day: 101 });
  });

  it("데려온 친구: 이 동네 애 → local, 다른 동네 애 → guest, 지난번 친구를 두고 오면 → leftBehind", () => {
    const save = emptySave();
    visitLandmark(save, 1, 1, homeOf);
    save.party = ["teapot"];
    expect(visitLandmark(save, 1, 2, homeOf).line).toBe("local");
    save.party = ["card"];
    expect(visitLandmark(save, 1, 3, homeOf).line).toBe("guest");
    save.party = [];
    expect(visitLandmark(save, 1, 4, homeOf).line).toBe("leftBehind");
  });
});

describe("오늘의 부탁", () => {
  const ctx = (day: number, hasLegends = true): QuestContext => ({
    day,
    festival: 0,
    regions: 6,
    homes: { teapot: 1, card: 2, c_rose: 3 },
    isNeighbour: (r) => r !== 3,
    hasLegends,
  });

  it("못 만난 친구가 있으면 → 데려오기(A), 이웃 지역 친구부터", () => {
    const save = emptySave();
    expect(tellQuest(save, ctx(6))).toBe("A");
    expect(["teapot", "card"]).toContain(save.quest!.k);
    expect(save.quest!.told).toBe(true);
  });

  it("다 만났으면 → 고래·안부·귀한 손님이 날마다 돌고, 전설이 없으면 귀한 손님 대신 안부", () => {
    const save = emptySave();
    for (const k of ["teapot", "card", "c_rose"]) save.collected[k] = { at: 0 };
    const types = [0, 1, 2].map((d) => {
      save.quest = null;
      return tellQuest(save, ctx(d, false));
    });
    expect(types).toEqual(["B", "C", "C"]);
  });

  it("데려오기는 그 친구를 데리고 와야 끝낼 수 있고, 끝내면 상자 하나", () => {
    const save = emptySave();
    tellQuest(save, ctx(6));
    const before = questReady(save);
    save.party = [save.quest!.k];
    const ready = questReady(save);
    finishQuest(save);
    expect([before, ready, save.quest!.done, save.boxes]).toEqual([false, true, true, 1]);
  });
});

import { describe, expect, it, vi } from "vitest";

import { lockedRewards, PLAY_KEY, readClear, recordClear } from "./play-record";

// 2026-11-26 03:00:00 UTC = 한국 시각 12:00
const NOON_KST = Date.UTC(2026, 10, 26, 3, 0, 0);

describe("recordClear · readClear", () => {
  it("깬 적 없는 이벤트 → 기록 없음", () => {
    expect(readClear("teum01")).toBeNull();
  });

  it("처음 깨면 → 한 번, 처음과 마지막이 같은 때(UTC 와 한국 시각 둘 다)", () => {
    recordClear({ eventId: "teum01", activityId: "teum", at: NOON_KST, seconds: 42.5 });
    expect(readClear("teum01")).toEqual({
      activityId: "teum",
      count: 1,
      firstAt: NOON_KST,
      firstDtm: "2026-11-26T12:00:00.000+09:00",
      lastAt: NOON_KST,
      lastDtm: "2026-11-26T12:00:00.000+09:00",
      bestSeconds: 42.5,
    });
  });

  it("다시 깨면 → 횟수가 늘고 마지막 때만 바뀐다, 가장 빠른 시간은 더 빠를 때만", () => {
    recordClear({ eventId: "teum01", activityId: "teum", at: NOON_KST, seconds: 40 });
    recordClear({ eventId: "teum01", activityId: "teum", at: NOON_KST + 60_000, seconds: 55 });
    recordClear({ eventId: "teum01", activityId: "teum", at: NOON_KST + 120_000, seconds: 31 });
    const record = readClear("teum01");
    expect([record?.count, record?.firstAt, record?.lastAt, record?.bestSeconds]).toEqual([
      3,
      NOON_KST,
      NOON_KST + 120_000,
      31,
    ]);
  });

  it("시간을 재지 않는 놀이 → 가장 빠른 시간 칸이 없다", () => {
    recordClear({ eventId: "booth01", activityId: "take-four", at: NOON_KST });
    expect(readClear("booth01")).not.toHaveProperty("bestSeconds");
  });

  it("걸린 시간이 셀 수 없는 값 → 시간 없이 적고, 기록은 다음에도 읽힌다", () => {
    recordClear({ eventId: "teum01", activityId: "teum", at: NOON_KST, seconds: Number.NaN });
    const record = readClear("teum01");
    expect([record?.count, record?.bestSeconds]).toEqual([1, undefined]);
  });

  it("처음 깬 것이면 → 참, 그 뒤로는 → 거짓(처음 깬 보상은 한 번만)", () => {
    const first = recordClear({ eventId: "teum01", activityId: "teum", at: NOON_KST }),
      again = recordClear({ eventId: "teum01", activityId: "teum", at: NOON_KST + 1 });
    expect([first, again]).toEqual([true, false]);
  });

  it("적지 못하는 기기 → 거짓(받았다고 알리지 않는다 — 옷장은 잠긴 채다)", () => {
    const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("막힘");
    });
    const first = recordClear({ eventId: "teum01", activityId: "teum", at: NOON_KST });
    blocked.mockRestore();
    expect([first, readClear("teum01")]).toEqual([false, null]);
  });

  it("이벤트마다 따로 남는다", () => {
    recordClear({ eventId: "teum01", activityId: "teum", at: NOON_KST });
    expect(readClear("teum02")).toBeNull();
  });

  it("객체에 원래 있는 이름의 이벤트 id → 기록 없음", () => {
    expect(readClear("toString")).toBeNull();
  });

  it("깨진 기록 → 깬 적 없는 것으로 보고, 다음에 깨면 새로 적는다", () => {
    localStorage.setItem(PLAY_KEY, "{broken");
    expect(readClear("teum01")).toBeNull();
    recordClear({ eventId: "teum01", activityId: "teum", at: NOON_KST });
    expect(readClear("teum01")?.count).toBe(1);
  });

  it("모양이 다른 칸 → 그 칸만 버린다", () => {
    const good = {
      activityId: "teum",
      count: 2,
      firstAt: 1,
      firstDtm: "a",
      lastAt: 2,
      lastDtm: "b",
    };
    const stored = { v: 1, clears: { teum01: good, odd: { count: "many" } } };
    localStorage.setItem(PLAY_KEY, JSON.stringify(stored));
    expect(readClear("teum01")).toEqual(good);
    expect(readClear("odd")).toBeNull();
  });
});

describe("lockedRewards — 아직 받지 못한 것", () => {
  const REWARDS = [
    { eventId: "teum01", item: "board", from: "틈" },
    { eventId: "sky02", item: "scarf", from: "하늘" },
  ];

  it("깬 적 없는 이벤트의 옷 → 잠겨 있다(옷장의 키 → 받는 곳의 이름)", () => {
    expect([...lockedRewards(REWARDS)]).toEqual([
      ["board", "틈"],
      ["scarf", "하늘"],
    ]);
  });

  it("그 이벤트를 깨면 → 그 옷만 풀린다", () => {
    recordClear({ eventId: "teum01", activityId: "teum", at: NOON_KST });
    expect([...lockedRewards(REWARDS)]).toEqual([["scarf", "하늘"]]);
  });
});

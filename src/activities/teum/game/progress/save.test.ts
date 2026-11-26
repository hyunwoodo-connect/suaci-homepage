import { describe, expect, it } from "vitest";

import { LEGACY_KEY } from "@/lib/avatar/legacy-record";

import { emptySave, readSave } from "./save";
import { LocalSaveStore, MemorySaveStore, SAVE_KEY } from "./store";

describe("readSave", () => {
  it("판이 다르거나 모양이 아니면 → 빈 기록", () => {
    expect(readSave({ v: 2, lm: { 1: { n: 1, day: 1 } } })).toEqual(emptySave());
    expect(readSave("x")).toEqual(emptySave());
  });

  it("깨진 칸만 버리고 나머지는 읽는다, 모르는 칸(옛 상자·부탁·지난번 친구)은 버린다", () => {
    const save = readSave({
      v: 1,
      boxes: 9,
      quest: { day: 4, k: "card", r: 2 },
      lm: { 2: { n: 3, pal: "teapot", day: 10 }, x: { n: 1, day: 1 }, 3: { n: "2", day: 1 } },
    });
    expect(save).toEqual({ v: 1, lm: { 2: { n: 3, day: 10 } } });
  });

  it("아바타 칸(look·dressed)이 남아 있는 기록 → 그 칸은 버린다(아바타는 공용 기록에 둔다)", () => {
    const save = readSave({ v: 1, lm: {}, look: { top: "stripe" }, dressed: true });
    expect(save).toEqual(emptySave());
  });
});

describe("SaveStore", () => {
  it("LocalSaveStore: 쓴 것을 다시 읽는다(suaci.teum.save 칸)", async () => {
    const store = new LocalSaveStore();
    const save = emptySave();
    save.lm[2] = { n: 2, day: 9 };
    await store.save(save);
    expect(localStorage.getItem(SAVE_KEY)).toContain('"lm":{"2":{"n":2,"day":9}}');
    await expect(store.load()).resolves.toEqual(save);
  });

  it("LocalSaveStore: 깨진 JSON → 빈 기록", async () => {
    localStorage.setItem(SAVE_KEY, "{");
    await expect(new LocalSaveStore().load()).resolves.toEqual(emptySave());
  });

  it("MemorySaveStore: 읽은 것을 고쳐도 저장한 것은 그대로(복사본)", async () => {
    const store = new MemorySaveStore();
    const save = await store.load();
    save.lm[1] = { n: 1, day: 1 };
    await expect(store.load()).resolves.toEqual(emptySave());
  });
});

describe("틈 기록의 키", () => {
  it("아바타 쪽이 옛 차림을 찾는 키와 같다(다르면 옛 차림을 옮겨 오지 못한다)", () => {
    expect(SAVE_KEY).toBe(LEGACY_KEY);
  });
});

import { describe, expect, it } from "vitest";

import { emptySave, readSave } from "./save";
import { LocalSaveStore, MemorySaveStore, SAVE_KEY } from "./store";

describe("readSave", () => {
  it("판이 다르거나 모양이 아니면 → 빈 기록", () => {
    expect(readSave({ v: 2, boxes: 3 })).toEqual(emptySave());
    expect(readSave("x")).toEqual(emptySave());
  });

  it("깨진 칸만 버리고 나머지는 읽는다(상자는 다섯까지, 데리고 다니기는 셋까지)", () => {
    const save = readSave({
      v: 1,
      collected: { teapot: { at: 5 }, card: "x" },
      party: ["teapot", 3, "card", "c_hat", "c_dice"],
      boxes: 9,
      lm: { 2: { n: 3, pal: "teapot", day: 10 }, x: { n: 1, day: 1 } },
      quest: { day: 4, k: "card", r: 2, type: "Z", done: true },
    });
    expect(save.collected).toEqual({ teapot: { at: 5 } });
    expect(save.party).toEqual(["teapot", "card", "c_hat"]);
    expect(save.boxes).toBe(5);
    expect(save.lm).toEqual({ 2: { n: 3, pal: "teapot", day: 10 } });
    expect(save.quest).toEqual({
      day: 4,
      k: "card",
      r: 2,
      type: "",
      done: true,
      told: false,
      mid: false,
    });
  });
});

describe("SaveStore", () => {
  it("LocalSaveStore: 쓴 것을 다시 읽는다(suaci.teum.save 칸)", async () => {
    const store = new LocalSaveStore();
    const save = emptySave();
    save.boxes = 2;
    await store.save(save);
    expect(localStorage.getItem(SAVE_KEY)).toContain('"boxes":2');
    await expect(store.load()).resolves.toEqual(save);
  });

  it("LocalSaveStore: 깨진 JSON → 빈 기록", async () => {
    localStorage.setItem(SAVE_KEY, "{");
    await expect(new LocalSaveStore().load()).resolves.toEqual(emptySave());
  });

  it("MemorySaveStore: 읽은 것을 고쳐도 저장한 것은 그대로(복사본)", async () => {
    const store = new MemorySaveStore();
    const save = await store.load();
    save.boxes = 4;
    await expect(store.load()).resolves.toEqual(emptySave());
  });
});

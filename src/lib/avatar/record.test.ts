import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_LOOK } from "./outfit";
import {
  AVATAR_KEY,
  emptyAvatarRecord,
  isBlankRecord,
  LocalAvatarStore,
  MemoryAvatarStore,
  readAvatarRecord,
} from "./record";

describe("readAvatarRecord", () => {
  it("값이 없거나 모양이 아니면 → 빈 기록", () => {
    const blank = emptyAvatarRecord();
    expect([readAvatarRecord(null), readAvatarRecord("x"), readAvatarRecord([])]).toEqual([
      blank,
      blank,
      blank,
    ]);
  });

  it("판(v)이 다르면 → 빈 기록(모르는 모양을 믿지 않는다)", () => {
    const other = { v: 2, look: { ...DEFAULT_LOOK }, dressed: true };
    expect(readAvatarRecord(other)).toEqual(emptyAvatarRecord());
  });

  it("차림과 꾸민 적 있음 → 그대로 읽는다", () => {
    const look = { ...DEFAULT_LOOK, hand: "bag" };
    const record = readAvatarRecord({ v: 1, look, dressed: true });
    expect(record).toEqual({ v: 1, look, dressed: true });
  });

  it("차림의 모르는 값 → 그 칸만 기본으로, dressed 는 true 일 때만 true", () => {
    const record = readAvatarRecord({ v: 1, look: { top: "stripe", face: "nope" }, dressed: 1 });
    expect([record.look?.top, record.look?.face, record.dressed]).toEqual([
      "stripe",
      "glass_heart",
      false,
    ]);
  });

  it("모르는 칸 → 버린다", () => {
    const record = readAvatarRecord({ v: 1, look: null, dressed: false, coins: 99 });
    expect(record).toEqual(emptyAvatarRecord());
  });
});

describe("isBlankRecord", () => {
  it("차림도 없고 꾸민 적도 없으면 → 비었다", () => {
    expect(isBlankRecord(emptyAvatarRecord())).toBe(true);
  });

  it("차림이 있거나 꾸민 적이 있으면 → 비지 않았다", () => {
    const dressedOnly = { ...emptyAvatarRecord(), dressed: true },
      lookOnly = { ...emptyAvatarRecord(), look: { ...DEFAULT_LOOK } };
    expect([isBlankRecord(dressedOnly), isBlankRecord(lookOnly)]).toEqual([false, false]);
  });
});

describe("LocalAvatarStore", () => {
  beforeEach(() => localStorage.clear());

  it("쓴 것을 다시 읽는다(이 기기의 suaci.avatar 칸)", async () => {
    const store = new LocalAvatarStore();
    const record = {
      ...emptyAvatarRecord(),
      look: { ...DEFAULT_LOOK, hair: "scarf" },
      dressed: true,
    };
    await store.save(record);
    expect(await new LocalAvatarStore().load()).toEqual(record);
    expect(localStorage.getItem(AVATAR_KEY)).not.toBeNull();
  });

  it("아무것도 없으면 → 빈 기록", async () => {
    expect(await new LocalAvatarStore().load()).toEqual(emptyAvatarRecord());
  });

  it("깨진 글이 들어 있으면 → 빈 기록(던지지 않는다)", async () => {
    localStorage.setItem(AVATAR_KEY, "{not json");
    expect(await new LocalAvatarStore().load()).toEqual(emptyAvatarRecord());
  });
});

describe("MemoryAvatarStore", () => {
  it("넣어 준 기록으로 시작하고, 쓴 것을 다시 읽는다(밖의 값을 붙잡지 않는다)", async () => {
    const start = { ...emptyAvatarRecord(), dressed: true };
    const store = new MemoryAvatarStore(start);
    start.dressed = false;
    const first = await store.load();
    await store.save({ ...first, look: { ...DEFAULT_LOOK } });
    const second = await store.load();
    expect([first.dressed, second.look]).toEqual([true, { ...DEFAULT_LOOK }]);
  });
});

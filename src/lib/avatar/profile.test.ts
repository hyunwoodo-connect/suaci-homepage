import { describe, expect, it } from "vitest";

import { DEFAULT_LOOK } from "./outfit";
import { AvatarProfile } from "./profile";
import type { AvatarRecord } from "./record";
import { emptyAvatarRecord, MemoryAvatarStore } from "./record";

/** 다른 자리에 남아 있던 기록 */
const OLD: AvatarRecord = { v: 1, look: { ...DEFAULT_LOOK, hand: "bag" }, dressed: true };

describe("AvatarProfile", () => {
  it("읽기 전에는 빈 기록, 읽은 뒤에는 둔 기록", async () => {
    const saved = { ...emptyAvatarRecord(), dressed: true };
    const profile = new AvatarProfile(new MemoryAvatarStore(saved));
    const before = profile.record;
    await profile.ready;
    expect([before, profile.record]).toEqual([emptyAvatarRecord(), saved]);
  });

  it("바꾸고 commit → 둔 곳에 남는다", async () => {
    const store = new MemoryAvatarStore();
    const profile = new AvatarProfile(store);
    await profile.ready;
    profile.record.look = { ...DEFAULT_LOOK, hair: "scarf" };
    profile.commit();
    expect((await store.load()).look?.hair).toBe("scarf");
  });

  it("공용 기록이 비어 있고 다른 자리에 기록이 남아 있으면 → 그것을 쓰고 공용에 옮겨 둔다", async () => {
    const store = new MemoryAvatarStore();
    const profile = new AvatarProfile(store, () => OLD);
    await profile.ready;
    expect([profile.record, await store.load()]).toEqual([OLD, OLD]);
  });

  it("공용 기록이 이미 있으면 → 다른 자리의 기록은 묻지도 않는다", async () => {
    const mine = { ...emptyAvatarRecord(), look: { ...DEFAULT_LOOK }, dressed: true };
    let asked = 0;
    const adopt = () => {
      asked++;
      return OLD;
    };
    const profile = new AvatarProfile(new MemoryAvatarStore(mine), adopt);
    await profile.ready;
    expect([profile.record, asked]).toEqual([mine, 0]);
  });

  it("공용도 비고 다른 자리에도 없으면 → 빈 기록 그대로(쓰지 않는다)", async () => {
    const store = new MemoryAvatarStore();
    let saves = 0;
    const save = store.save.bind(store);
    store.save = (record) => {
      saves++;
      return save(record);
    };
    const profile = new AvatarProfile(store, () => null);
    await profile.ready;
    expect([profile.record, saves]).toEqual([emptyAvatarRecord(), 0]);
  });
});

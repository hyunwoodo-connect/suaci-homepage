import { beforeEach, describe, expect, it } from "vitest";

import { LEGACY_KEY, legacyAvatar } from "./legacy-record";
import { DEFAULT_LOOK } from "./outfit";
import { AvatarProfile } from "./profile";
import { AVATAR_KEY, LocalAvatarStore } from "./record";

describe("legacyAvatar — 틈 기록 안에 남은 아바타 기록", () => {
  beforeEach(() => localStorage.clear());

  it("틈 기록에 차림과 꾸민 적이 들어 있으면 → 그 아바타 기록", () => {
    const look = { ...DEFAULT_LOOK, hand: "bag", bot: "#ff8fbd" };
    const old = { v: 1, lm: { 2: { n: 3, day: 10 } }, look, dressed: true };
    localStorage.setItem(LEGACY_KEY, JSON.stringify(old));
    expect(legacyAvatar()).toEqual({ v: 1, look, dressed: true });
  });

  it("차림만 있고 꾸민 적은 없어도 → 옮겨 온다", () => {
    const old = { v: 1, lm: {}, look: { ...DEFAULT_LOOK }, dressed: false };
    localStorage.setItem(LEGACY_KEY, JSON.stringify(old));
    expect(legacyAvatar()).toEqual({ v: 1, look: { ...DEFAULT_LOOK }, dressed: false });
  });

  it("틈 기록에 아바타 칸이 없으면(다녀간 기록만) → null", () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ v: 1, lm: { 1: { n: 1, day: 3 } } }));
    expect(legacyAvatar()).toBeNull();
  });

  it("틈 기록이 없거나 깨졌으면 → null(던지지 않는다)", () => {
    const none = legacyAvatar();
    localStorage.setItem(LEGACY_KEY, "{broken");
    expect([none, legacyAvatar()]).toEqual([null, null]);
  });

  it("차림의 모르는 값 → 그 칸만 기본으로 읽는다", () => {
    const old = { v: 1, look: { top: "stripe", face: "nope" }, dressed: true };
    localStorage.setItem(LEGACY_KEY, JSON.stringify(old));
    const record = legacyAvatar();
    expect([record?.look?.top, record?.look?.face]).toEqual(["stripe", "glass_heart"]);
  });
});

describe("이 기기에서의 한 바퀴 — 틈 기록 안의 차림이 공용 기록으로", () => {
  beforeEach(() => localStorage.clear());

  it("틈 기록에 차림이 있고 공용 기록이 없으면 → 공용 기록(suaci.avatar)에 옮겨지고, 틈 기록은 건드리지 않는다", async () => {
    const look = { ...DEFAULT_LOOK, hair: "scarf" };
    const old = JSON.stringify({ v: 1, lm: { 2: { n: 3, day: 10 } }, look, dressed: true });
    localStorage.setItem(LEGACY_KEY, old);
    const profile = new AvatarProfile(new LocalAvatarStore(), legacyAvatar);
    await profile.ready;
    const moved: unknown = JSON.parse(localStorage.getItem(AVATAR_KEY) ?? "null");
    expect([profile.record, moved, localStorage.getItem(LEGACY_KEY)]).toEqual([
      { v: 1, look, dressed: true },
      { v: 1, look, dressed: true },
      old,
    ]);
  });

  it("공용 기록이 이미 있으면 → 틈 기록 안의 옛 차림으로 덮지 않는다", async () => {
    const mine = { v: 1, look: { ...DEFAULT_LOOK, hand: "bouquet" }, dressed: true };
    localStorage.setItem(AVATAR_KEY, JSON.stringify(mine));
    const old = { v: 1, lm: {}, look: { ...DEFAULT_LOOK, hair: "scarf" }, dressed: true };
    localStorage.setItem(LEGACY_KEY, JSON.stringify(old));
    const profile = new AvatarProfile(new LocalAvatarStore(), legacyAvatar);
    await profile.ready;
    expect(profile.record).toEqual(mine);
  });
});

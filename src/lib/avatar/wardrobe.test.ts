import { describe, expect, it } from "vitest";

import { DEFAULT_LOOK } from "./outfit";
import { blankOutfit } from "./outfit-shader";
import { AvatarProfile } from "./profile";
import { emptyAvatarRecord, MemoryAvatarStore } from "./record";
import type { RigHandle } from "./rig";
import type { RigOwner } from "./wardrobe";
import { Wardrobe } from "./wardrobe";

/** 몸이 바로 오는 아바타와, 끼우고 뺀 것을 적는 뼈대 */
function setup(
  saved: Partial<ReturnType<typeof emptyAvatarRecord>> = {},
  dressNewcomer = true,
  locks = new Map<string, string>(),
  rand = () => 0,
) {
  const calls: string[] = [];
  const rig = {
    wear: (k: string) => calls.push(`+${k}`),
    strip: (slot: string) => calls.push(`-${slot}`),
  } as unknown as RigHandle;
  const avatar = { whenRig: (cb: (r: RigHandle) => void) => cb(rig) } as RigOwner;
  const store = new MemoryAvatarStore({ ...emptyAvatarRecord(), ...saved });
  const profile = new AvatarProfile(store);
  const outfit = blankOutfit();
  const wardrobe = new Wardrobe(outfit, avatar, profile, {
    dressNewcomer,
    rand,
    locks: () => locks,
  });
  return { wardrobe, profile, calls, outfit };
}

describe("Wardrobe · 아바타 기록", () => {
  /** 몸이 바로 오는 아바타 */
  const avatar = {
    whenRig: (cb: (r: RigHandle) => void) => cb({ wear() {}, strip() {} } as unknown as RigHandle),
  } as RigOwner;
  const options = { dressNewcomer: true, rand: () => 0, locks: () => new Map<string, string>() };

  it("공용 기록은 비었지만 다른 자리에 차림이 남아 있던 사람 → 그 차림을 입는다(처음 온 사람의 아무 차림으로 덮지 않는다)", async () => {
    const old = { ...emptyAvatarRecord(), look: { ...DEFAULT_LOOK, hand: "bag" }, dressed: true };
    const store = new MemoryAvatarStore();
    const profile = new AvatarProfile(store, () => old);
    const wardrobe = new Wardrobe(blankOutfit(), avatar, profile, options);
    await wardrobe.ready;
    const kept = await store.load();
    expect([wardrobe.look, wardrobe.hasDressed, kept]).toEqual([old.look, true, old]);
  });

  it("꾸민 적: 처음에는 false, markDressed 뒤로는 true 이고 기록에 남는다", async () => {
    const store = new MemoryAvatarStore();
    const profile = new AvatarProfile(store);
    const wardrobe = new Wardrobe(blankOutfit(), avatar, profile, options);
    await wardrobe.ready;
    const before = wardrobe.hasDressed;
    wardrobe.markDressed();
    const kept = await store.load();
    expect([before, wardrobe.hasDressed, kept.dressed]).toEqual([false, true, true]);
  });
});

describe("Wardrobe", () => {
  it("기록에 차림이 없으면 → 아무 차림을 입고 기록에 둔다, 몸이 오면 칸마다 끼운다", async () => {
    const { wardrobe, profile, calls } = setup();
    await wardrobe.ready;
    expect(profile.record.look).toEqual(wardrobe.look);
    expect(calls).toEqual(["+hair_bob", "-face", "-ear", "-hand", "-board"]);
  });

  it("저장된 차림 → 그대로 입는다(아무 차림으로 바꾸지 않는다)", async () => {
    const look = { ...DEFAULT_LOOK, hand: "bag", bot: "#ff8fbd" };
    const { wardrobe, outfit } = setup({ look });
    await wardrobe.ready;
    expect(wardrobe.look).toEqual(look);
    expect([outfit.uSkOn.value, `#${outfit.uSkC.value.getHexString()}`]).toEqual([1, "#ff8fbd"]);
  });

  it("이미 입은 것을 다시 고르면 → false, 되돌리기에 남지 않는다", async () => {
    const { wardrobe } = setup({ look: { ...DEFAULT_LOOK } });
    await wardrobe.ready;
    expect(wardrobe.pick("hand", "bouquet")).toBe(true);
    expect(wardrobe.pick("hand", "bouquet")).toBe(false);
    expect(wardrobe.undo()).toBe(true);
    expect(wardrobe.look.hand).toBe("");
    expect(wardrobe.undo()).toBe(false);
  });

  it("되돌리면 → 바뀐 칸만 다시 끼운다", async () => {
    const { wardrobe, calls } = setup({ look: { ...DEFAULT_LOOK } });
    await wardrobe.ready;
    wardrobe.pick("hair", "scarf");
    calls.length = 0;
    wardrobe.undo();
    expect(calls).toEqual(["+hair_bob"]);
  });

  it("아직 받지 못한 것을 고르면 → false, 차림도 기록도 그대로", async () => {
    const locks = new Map([["board", "틈"]]);
    const { wardrobe, profile } = setup({ look: { ...DEFAULT_LOOK } }, true, locks);
    await wardrobe.ready;
    expect(wardrobe.pick("board", "board")).toBe(false);
    expect([wardrobe.look.board, profile.record.look?.board]).toEqual(["", ""]);
  });

  it("받은 뒤에는(잠금이 풀리면) → 고를 수 있다", async () => {
    const locks = new Map([["board", "틈"]]);
    const { wardrobe } = setup({ look: { ...DEFAULT_LOOK } }, true, locks);
    await wardrobe.ready;
    locks.delete("board");
    expect(wardrobe.pick("board", "board")).toBe(true);
  });

  it("아무거나·처음 온 사람의 차림 → 아직 받지 못한 것은 들지 않는다", async () => {
    const locks = new Map([["board", "틈"]]);
    const { wardrobe } = setup({}, true, locks, () => 0.999);
    await wardrobe.ready;
    const first = wardrobe.look.board;
    wardrobe.shuffle();
    expect([first, wardrobe.look.board]).toEqual(["", ""]);
  });

  it("이미 입고 있던 것은 → 잠겨 있어도 그대로 입고 있다", async () => {
    const locks = new Map([["board", "틈"]]);
    const look = { ...DEFAULT_LOOK, board: "board" };
    const { wardrobe } = setup({ look }, true, locks);
    await wardrobe.ready;
    expect(wardrobe.look.board).toBe("board");
  });
});

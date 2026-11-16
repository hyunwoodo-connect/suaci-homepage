import { describe, expect, it } from "vitest";

import { Mats } from "../look";
import { Progress } from "../progress/progress";
import { emptySave } from "../progress/save";
import { MemorySaveStore } from "../progress/store";
import type { Avatar } from "./avatar";
import { DEFAULT_LOOK } from "./outfit";
import type { RigHandle } from "./rig";
import { Wardrobe } from "./wardrobe";

/** 몸이 바로 오는 아바타와, 끼우고 뺀 것을 적는 뼈대 */
function setup(saved: Partial<ReturnType<typeof emptySave>> = {}, dressNewcomer = true) {
  const calls: string[] = [];
  const rig = {
    wear: (k: string) => calls.push(`+${k}`),
    strip: (slot: string) => calls.push(`-${slot}`),
  } as unknown as RigHandle;
  const avatar = { whenRig: (cb: (r: RigHandle) => void) => cb(rig) } as unknown as Avatar;
  const store = new MemorySaveStore({ ...emptySave(), ...saved });
  const progress = new Progress(store);
  const mats = new Mats();
  const wardrobe = new Wardrobe(mats.lookU.outfit, avatar, progress, {
    dressNewcomer,
    rand: () => 0,
  });
  return { wardrobe, progress, calls, outfit: mats.lookU.outfit };
}

describe("Wardrobe", () => {
  it("기록에 차림이 없으면 → 아무 차림을 입고 기록에 둔다, 몸이 오면 칸마다 끼운다", async () => {
    const { wardrobe, progress, calls } = setup();
    await wardrobe.ready;
    expect(progress.save.look).toEqual(wardrobe.look);
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
});

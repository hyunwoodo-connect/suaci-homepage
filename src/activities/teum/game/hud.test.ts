import { describe, expect, it } from "vitest";

import { Hud } from "./hud";

describe("Hud 소리 끄기 단추", () => {
  it("달기 전 → 단추가 없다(낼 소리가 없으면 보이지 않는다)", () => {
    const parent = document.createElement("div");
    const hud = new Hud(parent);
    expect(parent.querySelector("button")).toBeNull();
    hud.dispose();
  });

  it("누르면 → 끄기·켜기를 알리고 읽는 이름이 바뀐다", () => {
    const parent = document.createElement("div");
    const hud = new Hud(parent);
    const got: boolean[] = [];
    hud.showMuteToggle(false, (muted) => got.push(muted));
    const button = parent.querySelector("button")!;
    const before = button.getAttribute("aria-label");
    button.click();
    expect([before, button.getAttribute("aria-label"), got]).toEqual([
      "소리 끄기",
      "소리 켜기",
      [true],
    ]);
    hud.dispose();
  });

  it("두 번 달아도 → 단추는 하나, dispose 하면 지운다", () => {
    const parent = document.createElement("div");
    const hud = new Hud(parent);
    hud.showMuteToggle(true, () => {});
    hud.showMuteToggle(true, () => {});
    const count = parent.querySelectorAll("button").length;
    hud.dispose();
    expect([count, parent.querySelectorAll("button").length]).toEqual([1, 0]);
  });
});

import { describe, expect, it } from "vitest";

import { GameEvents } from "./events";

describe("GameEvents", () => {
  it("on → emit 한 값이 듣는 차례대로 온다", () => {
    const events = new GameEvents();
    const got: string[] = [];
    events.on("bubblePopped", ({ combo }) => got.push(`a${combo}`));
    events.on("bubblePopped", ({ combo }) => got.push(`b${combo}`));
    events.emit("bubblePopped", { combo: 2 });
    expect(got).toEqual(["a2", "b2"]);
  });

  it("그만 듣기 → 그 뒤로는 오지 않는다(듣는 중에 그만둬도 이번 알림은 끝까지 간다)", () => {
    const events = new GameEvents();
    const got: string[] = [];
    const off = events.on("cloudBurst", () => {
      got.push("first");
      off();
    });
    events.on("cloudBurst", () => got.push("second"));
    events.emit("cloudBurst", {});
    events.emit("cloudBurst", {});
    expect(got).toEqual(["first", "second", "second"]);
  });

  it("듣는 이가 없는 알림 → 그냥 지나간다", () => {
    const events = new GameEvents();
    expect(() => events.emit("legendMet", { kind: "c_deer" })).not.toThrow();
  });
});

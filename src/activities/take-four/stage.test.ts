import { describe, it, expect } from "vitest";

import { STAGE, isStageOn } from "./stage";

const ON = { wall: true, entry: true };

describe("isStageOn", () => {
  it("2단계(벽)까지 나왔다 → wall만 true, entry는 레코드 스위치가 켜져도 false", () => {
    expect(STAGE).toEqual({ wall: true, entry: false });
    expect(isStageOn({ switches: { wall: true, entry: true } }, "wall")).toBe(true);
    expect(isStageOn({ switches: { wall: true, entry: true } }, "entry")).toBe(false);
  });

  it("나온 단계 + 스위치 켜짐 → true", () => {
    expect(isStageOn({ switches: { entry: true } }, "entry", ON)).toBe(true);
  });

  it("나온 단계라도 스위치가 꺼졌거나 없으면 → false", () => {
    expect(isStageOn({ switches: { wall: false } }, "wall", ON)).toBe(false);
    expect(isStageOn({ switches: {} }, "entry", ON)).toBe(false);
  });
});

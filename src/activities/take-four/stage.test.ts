import { describe, it, expect } from "vitest";

import { canPostToWall, isStageOn } from "./stage";

const ON = { wall: true, entry: true };
const WALL_ONLY = { wall: true, entry: false };

describe("stage", () => {
  it("isStageOn: 나온 기능 + 스위치 켜짐 → true", () => {
    expect(isStageOn({ switches: { entry: true } }, "entry", ON)).toBe(true);
  });

  it("isStageOn: 나온 기능이라도 스위치가 꺼졌거나 없으면 → false", () => {
    expect(isStageOn({ switches: { wall: false } }, "wall", ON)).toBe(false);
    expect(isStageOn({ switches: {} }, "entry", ON)).toBe(false);
  });

  it("isStageOn: 스위치가 켜져도 코드에 안 나온 기능 → false", () => {
    expect(isStageOn({ switches: { entry: true } }, "entry", WALL_ONLY)).toBe(false);
  });

  it("canPostToWall: 벽 켜짐·응모 꺼짐 → true", () => {
    expect(canPostToWall({ switches: { wall: true, entry: true } }, WALL_ONLY)).toBe(true);
  });

  it("canPostToWall: 응모도 켜지면 → false(그 자리는 응모)", () => {
    expect(canPostToWall({ switches: { wall: true, entry: true } }, ON)).toBe(false);
  });

  it("canPostToWall: 벽 스위치 꺼짐 → false", () => {
    expect(canPostToWall({ switches: {} }, ON)).toBe(false);
  });
});

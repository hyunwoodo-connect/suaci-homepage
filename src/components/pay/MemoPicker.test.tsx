import { describe, expect, it } from "vitest";

import { memoLabel } from "./MemoPicker";

const t = (key: string) => `T(${key})`;

describe("memoLabel", () => {
  it("고른 칩 값 → 그 언어의 이름", () => {
    expect(memoLabel("문 앞", t)).toBe("T(memo.door)");
  });

  it("직접 쓴 메모 → 쓴 그대로(객체 기본 속성 이름이어도)", () => {
    expect(memoLabel("2층 계단 앞", t)).toBe("2층 계단 앞");
    expect(memoLabel("constructor", t)).toBe("constructor");
  });
});

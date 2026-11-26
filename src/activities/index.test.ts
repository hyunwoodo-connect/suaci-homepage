import { describe, it, expect } from "vitest";

import { getActivity, usesAvatar } from ".";

describe("getActivity", () => {
  it("take-four → 등록된 놀이 모듈", () => {
    expect(getActivity("take-four")?.id).toBe("take-four");
  });

  it("없는 id → undefined", () => {
    expect(getActivity("nope")).toBeUndefined();
  });

  it("객체 기본 속성 이름 → undefined", () => {
    expect(getActivity("toString")).toBeUndefined();
  });
});

describe("usesAvatar", () => {
  it("아바타를 데리고 들어가는 놀이(틈) → 참", () => {
    expect(usesAvatar("teum")).toBe(true);
  });

  it("아바타를 쓰지 않는 놀이·모르는 놀이 → 거짓", () => {
    expect(usesAvatar("take-four")).toBe(false);
    expect(usesAvatar("nope")).toBe(false);
  });
});

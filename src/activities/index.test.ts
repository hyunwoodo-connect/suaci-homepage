import { describe, it, expect } from "vitest";

import { getActivity } from ".";

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

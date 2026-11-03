import { describe, expect, it } from "vitest";

import { addressName } from "./address";

describe("addressName", () => {
  it("배송지 이름이 있으면 → 그 이름", () => {
    expect(addressName({ label: "회사", recipient: "지우" })).toBe("회사");
  });

  it("비었거나 공백뿐이면 → 받는 분 이름", () => {
    expect(addressName({ recipient: "지우" })).toBe("지우");
    expect(addressName({ label: "  ", recipient: "지우" })).toBe("지우");
  });
});

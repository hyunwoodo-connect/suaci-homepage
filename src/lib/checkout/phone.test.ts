import { describe, expect, it } from "vitest";

import { formatPhoneInput, isValidPhone } from "./phone";

describe("phone", () => {
  it("입력 중 자동 하이픈 — 숫자만 남긴다", () => {
    expect(formatPhoneInput("0101234567 8")).toBe("010-1234-5678");
    expect(formatPhoneInput("010123")).toBe("010-123");
    expect(formatPhoneInput("0101234567")).toBe("010-123-4567");
    expect(formatPhoneInput("abc010-1234-5678def")).toBe("010-1234-5678");
  });
  it("isValidPhone: 010 + 7~8자리", () => {
    expect(isValidPhone("010-1234-5678")).toBe(true);
    expect(isValidPhone("010-123-4567")).toBe(true);
    expect(isValidPhone("02-123-4567")).toBe(false);
    expect(isValidPhone("010-12")).toBe(false);
  });
});

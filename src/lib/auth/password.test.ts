import { describe, expect, it } from "vitest";

import { isPasswordMismatch, passwordProblem } from "./password";

describe("password", () => {
  it("isPasswordMismatch: 확인 칸이 비었으면 아직 말하지 않는다", () => {
    expect(isPasswordMismatch("abcdefgh", "")).toBe(false);
  });

  it("isPasswordMismatch: 두 칸이 다르면 true, 같으면 false", () => {
    expect(isPasswordMismatch("abcdefgh", "abcdefg")).toBe(true);
    expect(isPasswordMismatch("abcdefgh", "abcdefgh")).toBe(false);
  });

  it("passwordProblem: 8자 미만 → tooShort(확인 칸이 같아도)", () => {
    expect(passwordProblem("abc1234", "abc1234")).toBe("tooShort");
  });

  it("passwordProblem: 8자 이상인데 확인이 다르거나 비었으면 → mismatch", () => {
    expect(passwordProblem("abcdefgh", "abcdefgx")).toBe("mismatch");
    expect(passwordProblem("abcdefgh", "")).toBe("mismatch");
  });

  it("passwordProblem: 8자 이상이고 같으면 → null", () => {
    expect(passwordProblem("abcdefgh", "abcdefgh")).toBeNull();
  });
});

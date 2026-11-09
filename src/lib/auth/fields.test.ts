import { describe, expect, it } from "vitest";

import { emailProblem, isBlank } from "./fields";

describe("fields", () => {
  it("emailProblem: 빈 칸 → empty, @·점이 없으면 invalid, 맞으면 null", () => {
    expect(emailProblem("  ")).toBe("empty");
    expect(emailProblem("mina")).toBe("invalid");
    expect(emailProblem("mina@mail")).toBe("invalid");
    expect(emailProblem(" mina@mail.com ")).toBeNull();
  });

  it("isBlank: 공백만 있어도 빈 칸", () => {
    expect(isBlank(" ")).toBe(true);
    expect(isBlank("a")).toBe(false);
  });
});

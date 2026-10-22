import { describe, it, expect, vi, afterEach } from "vitest";

import { forgetMine, hasRibbon, isMine, rememberMine, rememberRibbon } from "./local";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("wall/local", () => {
  it("rememberMine → isMine, forgetMine → 아님", () => {
    rememberMine("a");
    expect(isMine("a")).toBe(true);
    expect(isMine("b")).toBe(false);
    forgetMine("a");
    expect(isMine("a")).toBe(false);
  });

  it("rememberRibbon → hasRibbon, tf_ribbons에 남는다", () => {
    rememberRibbon("a");
    expect(hasRibbon("a")).toBe(true);
    expect(JSON.parse(localStorage.getItem("tf_ribbons") ?? "[]")).toEqual(["a"]);
  });

  it("같은 id 두 번 → 한 번만", () => {
    rememberMine("a");
    rememberMine("a");
    expect(JSON.parse(localStorage.getItem("tf_mine") ?? "[]")).toEqual(["a"]);
  });

  it("200개 넘으면 오래된 것부터 뺀다", () => {
    for (let i = 0; i < 201; i++) rememberRibbon(`id${i}`);
    expect(hasRibbon("id0")).toBe(false);
    expect(hasRibbon("id200")).toBe(true);
    expect(JSON.parse(localStorage.getItem("tf_ribbons") ?? "[]")).toHaveLength(200);
  });

  it("값이 깨짐 → 빈 목록으로", () => {
    localStorage.setItem("tf_mine", "{nope");
    expect(isMine("a")).toBe(false);
    rememberMine("a");
    expect(isMine("a")).toBe(true);
  });

  it("localStorage가 던짐 → 조용히 false", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => rememberMine("a")).not.toThrow();
    expect(isMine("a")).toBe(false);
    expect(() => forgetMine("a")).not.toThrow();
  });
});

import { describe, expect, it } from "vitest";

import { hideSet, isLookAround, isStatsShown } from "./params";

describe("숨바꼭질 주소 인자", () => {
  it("?hide → 1 이상의 정수면 그 묶음, 없거나 잘못되면 1", () => {
    expect(hideSet("?hide=3")).toBe(3);
    expect(hideSet("")).toBe(1);
    expect(hideSet("?hide=0")).toBe(1);
    expect(hideSet("?hide=two")).toBe(1);
    expect(hideSet("?hide=1.5")).toBe(1);
  });

  it("?look=1 → 둘러보기를 켠다(다른 값은 끈다)", () => {
    expect(isLookAround("?look=1")).toBe(true);
    expect(isLookAround("?look=0")).toBe(false);
    expect(isLookAround("")).toBe(false);
  });

  it("?debug → 끝 화면에 잰 값을 보인다", () => {
    expect(isStatsShown("?debug")).toBe(true);
    expect(isStatsShown("?hide=2&debug")).toBe(true);
    expect(isStatsShown("?hide=2")).toBe(false);
  });
});

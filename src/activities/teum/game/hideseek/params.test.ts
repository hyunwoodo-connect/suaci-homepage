import { describe, expect, it } from "vitest";

import { buildStamp, forcedLevel, hideSet, isLookAround, isStatsShown } from "./params";

describe("숨바꼭질 주소 인자", () => {
  it("?hide → 1 이상의 정수면 그 묶음, 없거나 잘못되면 null(어려움 단계대로 고른다)", () => {
    expect(hideSet("?hide=3")).toBe(3);
    expect(hideSet("")).toBeNull();
    expect(hideSet("?hide=0")).toBeNull();
    expect(hideSet("?hide=two")).toBeNull();
    expect(hideSet("?hide=1.5")).toBeNull();
  });

  it("forcedLevel: 0·1·2 만, 없거나 틀리면 null", () => {
    expect(forcedLevel("?level=2")).toBe(2);
    expect(forcedLevel("?level=0")).toBe(0);
    expect(forcedLevel("")).toBeNull();
    expect(forcedLevel("?level=5")).toBeNull();
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

  it("빌드 표시 → 커밋 앞 7자와 한국 시간, 값이 없으면 local", () => {
    expect(buildStamp("8994849", "2026-11-16T07:03:31.000Z")).toBe("8994849 · 11-16 16:03 KST");
    expect(buildStamp("", "2026-11-16T15:30:00.000Z")).toBe("local · 11-17 00:30 KST");
    expect(buildStamp("abc1234", undefined)).toBe("abc1234");
  });
});

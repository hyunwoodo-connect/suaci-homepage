import { describe, it, expect } from "vitest";

import { captionText, stripCaption, stripFilename } from "./caption";

// 2026-10-22 23:30 UTC = 10-23 08:30 KST
const LATE_UTC = new Date("2026-10-22T23:30:00Z");

describe("caption", () => {
  it.each(["upcoming", "live"] as const)("%s → No.01 표시, 번호는 no.----", (phase) => {
    const caption = stripCaption(phase, LATE_UTC, "No.01");
    expect(caption.eventLabel).toBe("No.01");
    expect(captionText(caption)).toEqual({ number: "no.----", meta: "No.01 · 10.23" });
  });

  it("ended → 이벤트 표시 없이 날짜만", () => {
    const caption = stripCaption("ended", LATE_UTC, "No.01");
    expect(caption.eventLabel).toBeNull();
    expect(captionText(caption)).toEqual({ number: "no.----", meta: "10.23" });
  });

  it("이벤트 내용이 없음(label null) → 진행 중이어도 이벤트 표시 없음", () => {
    const caption = stripCaption("live", LATE_UTC, null);
    expect(caption.eventLabel).toBeNull();
    expect(captionText(caption).meta).toBe("10.23");
  });

  it("파일 이름 → 한국 날짜", () => {
    expect(stripFilename(stripCaption("live", LATE_UTC, "No.01"))).toBe("take-four-1023.jpg");
  });
});

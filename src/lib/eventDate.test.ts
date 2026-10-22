import { describe, it, expect } from "vitest";
import { formatKoreanMonthDay, kstDateLabel } from "./eventDate";

describe("eventDate", () => {
  it("formatKoreanMonthDay: KST 기준 M월 D일 (0 패딩 없음)", () => {
    expect(formatKoreanMonthDay(Date.parse("2027-01-26T00:00:00+09:00"))).toBe("1월 26일");
    expect(formatKoreanMonthDay(Date.parse("2027-03-05T10:00:00+09:00"))).toBe("3월 5일");
  });

  it("formatKoreanMonthDay: UTC로는 전날이어도 KST 날짜를 쓴다", () => {
    expect(formatKoreanMonthDay(Date.parse("2026-12-31T16:00:00Z"))).toBe("1월 1일");
  });

  it("kstDateLabel: UTC로 전날 밤이어도 → 한국 날짜 MM.DD", () => {
    expect(kstDateLabel(new Date("2026-10-22T23:30:00Z"))).toBe("10.23");
  });

  it("kstDateLabel: 한 자리 달·날 → 0을 채운다, ms도 받는다", () => {
    expect(kstDateLabel(Date.parse("2027-01-05T03:00:00Z"))).toBe("01.05");
  });
});

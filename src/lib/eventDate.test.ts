import { describe, it, expect } from "vitest";
import { formatKoreanMonthDay } from "./eventDate";

describe("eventDate", () => {
  it("formatKoreanMonthDay: KST 기준 M월 D일 (0 패딩 없음)", () => {
    expect(formatKoreanMonthDay(Date.parse("2027-01-26T00:00:00+09:00"))).toBe("1월 26일");
    expect(formatKoreanMonthDay(Date.parse("2027-03-05T10:00:00+09:00"))).toBe("3월 5일");
  });

  it("formatKoreanMonthDay: UTC로는 전날이어도 KST 날짜를 쓴다", () => {
    expect(formatKoreanMonthDay(Date.parse("2026-12-31T16:00:00Z"))).toBe("1월 1일");
  });
});

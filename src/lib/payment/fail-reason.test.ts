import { describe, expect, it } from "vitest";

import { failReason } from "./fail-reason";

describe("failReason", () => {
  it("손님이 창을 닫음(PAY_PROCESS_CANCELED) → canceled", () => {
    expect(failReason("PAY_PROCESS_CANCELED")).toBe("canceled");
  });

  it.each([
    "REJECT_CARD_COMPANY",
    "EXCEED_MAX_PAYMENT_AMOUNT",
    "INVALID_CARD_NUMBER",
    "INVALID_STOPPED_CARD",
  ])("카드사 거절·한도·카드 정보(%s) → declined", (code) => {
    expect(failReason(code)).toBe("declined");
  });

  it("그 밖의 코드·코드 없음 → failed", () => {
    expect(failReason("PAY_PROCESS_ABORTED")).toBe("failed");
    expect(failReason(null)).toBe("failed");
  });
});

import { describe, expect, it } from "vitest";

import { failReason } from "./fail-reason";

describe("failReason", () => {
  it("손님이 창을 닫음(PAY_PROCESS_CANCELED) → 취소로 안내, 토스 글은 쓰지 않는다", () => {
    expect(failReason("PAY_PROCESS_CANCELED", "결제가 사용자에 의해 취소되었습니다.")).toEqual({
      kind: "canceled",
      message: "",
    });
  });

  it("그 밖의 코드 → 실패 + 토스 안내 글", () => {
    expect(failReason("REJECT_CARD_COMPANY", " 결제 승인이 거절되었습니다. ")).toEqual({
      kind: "failed",
      message: "결제 승인이 거절되었습니다.",
    });
  });

  it("코드·글이 없으면 → 실패, 빈 글", () => {
    expect(failReason(null, null)).toEqual({ kind: "failed", message: "" });
  });

  it("너무 긴 글은 120자로 자른다", () => {
    expect(failReason("X", "가".repeat(300)).message).toHaveLength(120);
  });
});

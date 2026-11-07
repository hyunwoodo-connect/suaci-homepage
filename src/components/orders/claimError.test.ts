import { describe, expect, it } from "vitest";

import { ApiClientError } from "@/lib/api";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import ko from "@/messages/ko.json";

import { claimErrorKey } from "./claimError";

/** 손님 화면이 받는 거절 코드(suaci-api 클레임 계약 2026-11-07) */
const CONTRACT_CODES = [
  "ORDER_NOT_CANCELLABLE",
  "CLAIM_NOT_ALLOWED",
  "OVER_REFUND",
  "INVALID_CLAIM_QUANTITY",
  "REFUND_IN_PROGRESS",
  "RETURN_WINDOW_CLOSED",
  "RETURN_ALREADY_REQUESTED",
  "RETURN_NOT_ALLOWED",
  "RETURN_UNOPENED_REQUIRED",
  "NOTHING_TO_REFUND",
  "EXCHANGE_NOT_ALLOWED",
  "EXCHANGE_WINDOW_CLOSED",
  "CLAIM_NOT_WITHDRAWABLE",
  "ADDRESS_CHANGE_NOT_ALLOWED",
  "ADDRESS_NOT_FOUND",
];

describe("claimErrorKey", () => {
  it.each(CONTRACT_CODES)("%s → 세 언어 모두 그 코드의 문구가 있다", (code) => {
    const key = claimErrorKey(new ApiClientError(code, "x", 409));
    expect(key).toBe(`error.${code}`);
    for (const catalog of [ko, en, ja]) {
      expect((catalog.claims.error as Record<string, string>)[code]).toBeTruthy();
    }
  });

  it("모르는 코드·네트워크 실패 → 잠시 뒤 다시(default)", () => {
    expect(claimErrorKey(new ApiClientError("WHAT", "x", 500))).toBe("error.default");
    expect(claimErrorKey(new TypeError("Failed to fetch"))).toBe("error.default");
  });
});

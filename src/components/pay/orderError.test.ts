import { describe, expect, it } from "vitest";

import ko from "@/messages/ko.json";
import { ApiClientError } from "@/lib/api";

import { orderErrorKey } from "./orderError";

describe("orderErrorKey", () => {
  it("아는 코드(품절) → 그 코드의 문구", () => {
    expect(orderErrorKey(new ApiClientError("OUT_OF_STOCK", "", 409))).toBe("error.OUT_OF_STOCK");
  });

  it("모르는 코드 → GENERIC", () => {
    expect(orderErrorKey(new ApiClientError("ITEM_NOT_PURCHASABLE", "", 400))).toBe(
      "error.GENERIC",
    );
  });

  it("ApiClientError 가 아닌 실패(네트워크·결제창) → GENERIC", () => {
    expect(orderErrorKey(new TypeError("Failed to fetch"))).toBe("error.GENERIC");
  });

  it("고르는 키는 모두 checkout 메시지에 있다", () => {
    const keys = ["ADDRESS_NOT_FOUND", "PAYMENT_AMOUNT_MISMATCH", "OUT_OF_STOCK", "AUTH_REQUIRED"];
    for (const code of keys) {
      const key = orderErrorKey(new ApiClientError(code, "", 400)).replace("error.", "");
      expect(ko.checkout.error).toHaveProperty(key);
    }
  });
});

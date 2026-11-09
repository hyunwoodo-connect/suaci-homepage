import { describe, expect, it } from "vitest";

import { isSensitiveLocation, safePageLocation } from "./analytics-url";

describe("safePageLocation", () => {
  it("쿼리는 utm_* 만 남긴다(이메일·결제 키·토큰은 버린다)", () => {
    expect(
      safePageLocation(
        "https://takesuaci.com/password/reset?email=a%40b.com&utm_source=ig&utm_campaign=launch",
      ),
    ).toBe("https://takesuaci.com/password/reset?utm_source=ig&utm_campaign=launch");
    expect(
      safePageLocation("https://takesuaci.com/pay/complete?o=1&paymentKey=k&orderId=n&amount=1"),
    ).toBe("https://takesuaci.com/pay/complete");
    expect(safePageLocation("https://takesuaci.com/en/checkout?qty=3#x")).toBe(
      "https://takesuaci.com/en/checkout",
    );
  });
});

describe("isSensitiveLocation", () => {
  it.each([
    "https://takesuaci.com/password/reset?email=a%40b.com",
    "https://takesuaci.com/auth/kakao/callback?code=c&state=s",
    "https://takesuaci.com/ja/pay/complete?paymentKey=k",
    "https://takesuaci.com/pay/fail?code=USER_CANCEL",
    "https://takesuaci.com/events/spring?preview=tok",
  ])("%s → 보내지 않는다", (href) => {
    expect(isSensitiveLocation(href)).toBe(true);
  });

  it.each([
    "https://takesuaci.com/",
    "https://takesuaci.com/?buy=1&qty=3",
    "https://takesuaci.com/en/checkout?qty=3",
    "https://takesuaci.com/orders/01ABC?welcome=1",
    "https://takesuaci.com/events/spring",
    "https://takesuaci.com/payment-guide",
  ])("%s → 보내도 된다", (href) => {
    expect(isSensitiveLocation(href)).toBe(false);
  });
});

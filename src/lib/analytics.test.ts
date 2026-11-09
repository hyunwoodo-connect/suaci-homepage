import { afterEach, describe, expect, it, vi } from "vitest";

import { analyticsIds, trackBeginCheckout, trackLead, trackPurchase } from "./analytics";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analyticsIds", () => {
  it("모양이 맞는 ID만 받는다(스크립트에 그대로 들어가므로)", () => {
    expect(analyticsIds("G-ABC123XYZ", "1234567890123")).toEqual({
      ga4: "G-ABC123XYZ",
      pixel: "1234567890123",
    });
  });
  it("비었거나 모양이 틀리면 그 도구는 끈다", () => {
    expect(analyticsIds(undefined, "")).toEqual({ ga4: null, pixel: null });
    expect(analyticsIds("G-abc');alert(1)//", "12ab")).toEqual({ ga4: null, pixel: null });
  });
});

describe("trackLead", () => {
  it("도구가 실려 있으면 GA4 generate_lead + 픽셀 Lead를 한 번씩", () => {
    const gtag = vi.fn();
    const fbq = vi.fn();
    vi.stubGlobal("gtag", gtag);
    vi.stubGlobal("fbq", fbq);
    trackLead("teaser");
    expect(gtag).toHaveBeenCalledWith("event", "generate_lead", {
      lead_source: "waitlist",
      source: "teaser",
    });
    expect(fbq).toHaveBeenCalledWith("track", "Lead", { content_name: "waitlist" });
  });
  it("도구가 없으면(ID 미설정·차단) 아무 일도 없다", () => {
    expect(() => trackLead()).not.toThrow();
  });
});

describe("trackBeginCheckout", () => {
  it("결제창을 열 때 금액·수량을 KRW 로", () => {
    const gtag = vi.fn();
    const fbq = vi.fn();
    vi.stubGlobal("gtag", gtag);
    vi.stubGlobal("fbq", fbq);
    trackBeginCheckout(56000, 2);
    expect(gtag).toHaveBeenCalledWith("event", "begin_checkout", {
      currency: "KRW",
      value: 56000,
      items: [{ quantity: 2 }],
    });
    expect(fbq).toHaveBeenCalledWith("track", "InitiateCheckout", {
      currency: "KRW",
      value: 56000,
      num_items: 2,
    });
  });
});

describe("trackPurchase", () => {
  it("주문번호로 한 번만 보낸다(완료 화면 새로고침에도 두 번 세지 않는다)", () => {
    localStorage.clear();
    const gtag = vi.fn();
    const fbq = vi.fn();
    vi.stubGlobal("gtag", gtag);
    vi.stubGlobal("fbq", fbq);
    const purchase = { orderNo: "20270105-ABC123", value: 31000, quantity: 1 };
    trackPurchase(purchase);
    trackPurchase(purchase);
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "purchase", {
      transaction_id: "20270105-ABC123",
      currency: "KRW",
      value: 31000,
      items: [{ quantity: 1 }],
    });
    expect(fbq).toHaveBeenCalledTimes(1);
    expect(fbq).toHaveBeenCalledWith(
      "track",
      "Purchase",
      { currency: "KRW", value: 31000, num_items: 1 },
      { eventID: "20270105-ABC123" },
    );
  });

  it("도구가 실리지 않았으면(동의 전) → 아무것도 남기지 않는다(나중에 허용해도 다시 보낼 수 있게)", () => {
    localStorage.clear();
    trackPurchase({ orderNo: "20270105-XYZ999", value: 31000, quantity: 1 });
    expect(localStorage.getItem("suaci.analytics.purchased")).toBeNull();
  });
});

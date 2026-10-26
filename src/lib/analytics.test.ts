import { afterEach, describe, expect, it, vi } from "vitest";

import { analyticsIds, trackLead } from "./analytics";

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

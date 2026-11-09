import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pathname } = vi.hoisted(() => ({ pathname: { value: "/" } }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

import { readConsent, saveConsent } from "@/lib/analytics-consent";

import ConsentedAnalytics from "./ConsentedAnalytics";

const COPY = {
  title: "[선택] 방문 분석 동의",
  body: "쿠키를 써도 될까요?",
  disclosures: ["목적: 사이트 이용 분석", "동의하지 않아도 이용에 제한이 없어요."],
  more: "자세히 보기",
  allow: "허용",
  decline: "거부",
  details: "개인정보처리방침",
};
const IDS = { ga4: "G-TEST1234", pixel: "1234567890123" };

interface ToolWindow {
  dataLayer?: IArguments[];
  gtag?: unknown;
  fbq?: { queue: unknown[][] };
  _fbq?: unknown;
}
const tools = () => window as unknown as ToolWindow;

function renderIt() {
  return render(<ConsentedAnalytics ids={IDS} copy={COPY} privacyHref="/legal/privacy" />);
}

function loadedScripts(): string[] {
  return [...document.head.querySelectorAll("script")].map((s) => s.src);
}

/** dataLayer 의 gtag 호출을 [명령, …] 배열로 */
function gtagCalls(): unknown[][] {
  return (tools().dataLayer ?? []).map((args) => [...args]);
}

describe("ConsentedAnalytics", () => {
  beforeEach(() => {
    localStorage.clear();
    pathname.value = "/";
    window.history.replaceState(null, "", "/");
  });
  afterEach(() => {
    const w = tools();
    delete w.dataLayer;
    delete w.gtag;
    delete w.fbq;
    delete w._fbq;
    document.head.querySelectorAll("script").forEach((s) => s.remove());
  });

  it("아직 고르지 않았으면 → 배너만, 도구는 싣지 않는다", () => {
    renderIt();
    expect(screen.getByText(/쿠키를 써도 될까요/)).toBeTruthy();
    // 동의에 꼭 알릴 것은 '자세히' 안에 있다(목적·불이익 없음…)
    expect(screen.getByText("자세히 보기")).toBeTruthy();
    expect(screen.getByText("동의하지 않아도 이용에 제한이 없어요.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "개인정보처리방침" }).getAttribute("href")).toBe(
      "/legal/privacy",
    );
    expect(loadedScripts()).toHaveLength(0);
    expect(tools().gtag).toBeUndefined();
  });

  it("허용 → 배너가 닫히고 GA4(구글 신호·자동 page_view 끔)·픽셀(자동 추적 끔)을 싣는다", () => {
    renderIt();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "허용" }));
    });
    expect(screen.queryByText(/쿠키를 써도 될까요/)).toBeNull();
    expect(readConsent()).toBe("granted");
    expect(loadedScripts()).toEqual([
      "https://www.googletagmanager.com/gtag/js?id=G-TEST1234",
      "https://connect.facebook.net/en_US/fbevents.js",
    ]);
    expect(gtagCalls()).toContainEqual([
      "config",
      "G-TEST1234",
      {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      },
    ]);
    const pixel = tools().fbq;
    expect(pixel?.queue).toContainEqual(["set", "autoConfig", false, "1234567890123"]);
    expect(pixel?.queue).toContainEqual(["init", "1234567890123"]);
  });

  it("page_view 는 쿼리를 걷어 낸 주소로, 비밀이 있는 화면에서는 픽셀 PageView 를 보내지 않는다", () => {
    saveConsent("granted");
    window.history.replaceState(null, "", "/password/reset?email=a%40b.com&utm_source=ig");
    pathname.value = "/password/reset";
    renderIt();
    expect(gtagCalls()).toContainEqual([
      "event",
      "page_view",
      { page_location: "http://localhost:3000/password/reset?utm_source=ig" },
    ]);
    expect(JSON.stringify(gtagCalls())).not.toContain("a%40b.com");
    expect(tools().fbq?.queue).not.toContainEqual(["track", "PageView"]);
  });

  it("비밀이 없는 화면 → 픽셀 PageView", () => {
    saveConsent("granted");
    window.history.replaceState(null, "", "/?buy=1&qty=3");
    renderIt();
    expect(tools().fbq?.queue).toContainEqual(["track", "PageView"]);
  });

  it("거부 → 배너가 닫히고 아무것도 싣지 않는다", () => {
    renderIt();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "거부" }));
    });
    expect(screen.queryByText(/쿠키를 써도 될까요/)).toBeNull();
    expect(loadedScripts()).toHaveLength(0);
    expect(readConsent()).toBe("denied");
  });

  it("허용하지 않은 채 들어오면 → 전에 남은 분석 쿠키를 지운다, 다시 묻지 않는다", () => {
    saveConsent("denied");
    document.cookie = "_ga=GA1.1.1; path=/";
    document.cookie = "keep=1; path=/";
    renderIt();
    expect(screen.queryByText(/쿠키를 써도 될까요/)).toBeNull();
    expect(document.cookie).not.toContain("_ga=");
    expect(document.cookie).toContain("keep=1");
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({
  default: ({ id, src }: { id?: string; src?: string }) => (
    <span data-testid="script" data-id={id ?? src} />
  ),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

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

function renderIt() {
  return render(<ConsentedAnalytics ids={IDS} copy={COPY} privacyHref="/legal/privacy" />);
}

describe("ConsentedAnalytics", () => {
  beforeEach(() => {
    localStorage.clear();
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
    expect(screen.queryAllByTestId("script")).toHaveLength(0);
  });

  it("허용 → 배너가 닫히고 GA4·픽셀을 싣는다, 선택을 남긴다", () => {
    renderIt();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "허용" }));
    });
    expect(screen.queryByText(/쿠키를 써도 될까요/)).toBeNull();
    const loaded = screen.getAllByTestId("script").map((s) => s.getAttribute("data-id"));
    expect(loaded).toEqual(
      expect.arrayContaining(["ga4", "meta-pixel", expect.stringContaining("G-TEST1234")]),
    );
    expect(readConsent()).toBe("granted");
  });

  it("거부 → 배너가 닫히고 아무것도 싣지 않는다", () => {
    renderIt();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "거부" }));
    });
    expect(screen.queryByText(/쿠키를 써도 될까요/)).toBeNull();
    expect(screen.queryAllByTestId("script")).toHaveLength(0);
    expect(readConsent()).toBe("denied");
  });

  it("전에 거부했으면 → 다시 묻지 않는다", () => {
    saveConsent("denied");
    renderIt();
    expect(screen.queryByText(/쿠키를 써도 될까요/)).toBeNull();
    expect(screen.queryAllByTestId("script")).toHaveLength(0);
  });
});

import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import SiteFooter from "./SiteFooter";

describe("SiteFooter", () => {
  it("주문 조회·정책·문의 링크와 고객센터 이메일이 있다", () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <SiteFooter />
      </NextIntlClientProvider>,
    );
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(
      expect.arrayContaining(["/orders", "/legal/refund", "/legal/terms", "/legal/privacy"]),
    );
    expect(screen.getByText("hello@takesuaci.com")).toBeTruthy();
  });

  it("사업자 정보 → 사업자등록증(2026-11-04 발급)과 글자까지 같다(카드사 심사는 다르면 반려)", () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <SiteFooter />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("수아시")).toBeTruthy();
    expect(screen.getByText("진시우, 도현우")).toBeTruthy();
    expect(
      screen.getByText(
        "대전광역시 유성구 동서대로656번길 16-12, 207동 701호(용계동, 힐스테이트 도안 2차)",
      ),
    ).toBeTruthy();
    expect(screen.getByText(/315-15-68551/)).toBeTruthy();
  });
});

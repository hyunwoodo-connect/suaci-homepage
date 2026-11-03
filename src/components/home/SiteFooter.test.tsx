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
  it("판매 전(SALES_OPEN false) → 잠긴 주문 조회 링크는 없고, 정책·문의 링크와 고객센터 이메일은 있다", () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <SiteFooter />
      </NextIntlClientProvider>,
    );
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/orders");
    expect(hrefs).toEqual(
      expect.arrayContaining(["/legal/refund", "/legal/terms", "/legal/privacy"]),
    );
    expect(screen.getByText("hello@takesuaci.com")).toBeTruthy();
  });
});

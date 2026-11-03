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
});

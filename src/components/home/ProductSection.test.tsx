import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import ko from "@/messages/ko.json";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import ProductSection from "./ProductSection";

describe("ProductSection — 반품 제한 고지(전자상거래법 제17조제6항)", () => {
  it("ko → 접힌 배송·반품을 펼치지 않아도 고지 + 배송·교환·환불 안내 링크가 보인다", () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <ProductSection />
      </NextIntlClientProvider>,
    );
    const notice = screen.getByText(
      /화장품은 밀봉을 뜯거나 사용하면 단순 변심으로 반품할 수 없어요\./,
    );
    expect(notice.closest("details")).toBeNull();
    expect(screen.getByRole("link", { name: "배송·교환·환불 안내" })).toHaveAttribute(
      "href",
      "/legal/refund",
    );
  });

  it("en → 영어 고지 + shipping & returns 링크", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ProductSection />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/can't be returned for a change of mind/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "shipping & returns" })).toHaveAttribute(
      "href",
      "/legal/refund",
    );
  });
});

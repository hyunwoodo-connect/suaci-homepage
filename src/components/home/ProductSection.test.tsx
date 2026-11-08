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
    // 접힌 배송·반품 본문에도 같은 문장이 있다 — 펼치지 않아도 보이는 고지가 하나 있어야 한다
    const notices = screen.getAllByText(
      /밀봉을 뜯었거나 사용한 화장품은 단순 변심으로 반품할 수 없어요\./,
    );
    expect(notices.some((n) => n.closest("details") === null)).toBe(true);
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
    expect(screen.getByText(/once the seal is opened or the product is used/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "shipping & returns" })).toHaveAttribute(
      "href",
      "/legal/refund",
    );
  });

  it("배송·반품 → 배송·교환·환불 안내 2판 요약(배송비·무료 기준은 주문서와 같은 상수)", () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <ProductSection />
      </NextIntlClientProvider>,
    );
    const body = screen.getByText(/국내 배송만 가능해요\(택배\)\./);
    expect(body.closest("details")).not.toBeNull();
    expect(body.textContent).toContain("배송비는 ₩3,000이고 ₩50,000 이상 구매하면 무료예요.");
    expect(body.textContent).toContain("받은 날부터 7일 안에 반품을 신청할 수 있어요.");
    // 단순 변심 반품 배송비: 편도, 무료 배송이면 처음 배송비까지(환불 정책 v2)
    expect(body.textContent).toContain("편도 ₩3,000");
    expect(body.textContent).toContain("처음 배송비까지 합쳐 ₩6,000");
    expect(body.textContent).toContain(
      "밀봉을 뜯었거나 사용한 화장품은 단순 변심으로 반품할 수 없어요.",
    );
    expect(body.textContent).not.toContain("준비 중");
  });

  it("다른 브랜드 사진 없이 '제품 사진 준비 중' 자리만", () => {
    const { container } = render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <ProductSection />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("img", { name: "제품 사진 준비 중" })).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("전성분 → 1차 전성분표 한 줄(ko 한글 이름, 향료 속 리모넨·리날룰 끝)", () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <ProductSection />
      </NextIntlClientProvider>,
    );
    const body = screen.getByText(/^정제수, 다이프로필렌글라이콜/);
    expect(body.closest("details")?.textContent).toContain("전성분");
    expect(body.textContent?.endsWith("리모넨, 리날룰")).toBe(true);
  });

  it("en → 전성분은 INCI 이름", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ProductSection />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/^Aqua, Dipropylene Glycol/)).toBeTruthy();
  });
});

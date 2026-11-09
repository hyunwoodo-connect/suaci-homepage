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

  it("실제 제품 사진이 오기 전 → 사진 칸도 '준비 중' 상자도 없다(다른 브랜드·AI 사진 없음)", () => {
    const { container } = render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <ProductSection />
      </NextIntlClientProvider>,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.textContent).not.toContain("준비 중");
  });

  it("가격 바로 아래 배송비 한 줄(하단 바에서 내림)", () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <ProductSection />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("배송비 ₩3,000 (₩50,000 이상 구매 시 무료)")).toBeTruthy();
  });

  it("전성분 → 1차 전성분표 한 줄(ko 한글 이름, 향료 속 리모넨·리날룰 끝)", () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <ProductSection />
      </NextIntlClientProvider>,
    );
    const body = screen.getByText(/^정제수, 다이프로필렌글라이콜/);
    expect(body.closest("details")?.textContent).toContain("전성분");
    expect(body.textContent?.endsWith("포타슘하이알루로네이트")).toBe(true);
    // 향료 속 알레르기 유발 성분은 바로 아래 따로
    expect(screen.getByText("향료 속 알레르기 유발 성분: 리모넨, 리날룰")).toBeTruthy();
  });

  it("상품정보제공 고시 → 펼친 채 11칸, 정하지 못한 칸은 사유(임의 값 없음)", () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <ProductSection />
      </NextIntlClientProvider>,
    );
    const title = screen.getByText("상품 정보 제공 고시");
    const details = title.closest("details");
    expect(details?.open).toBe(true);
    const terms = details?.querySelectorAll("dt") ?? [];
    expect(terms).toHaveLength(11);
    expect(terms[0]?.textContent).toBe("내용물의 용량 또는 중량");
    const text = details?.textContent ?? "";
    expect(text).toContain("100 ml");
    expect(text).toContain("해당 없음(일반 화장품)");
    expect(text).toContain("화장품책임판매업자: 수아시 (화장품책임판매업 제53463호)");
    expect(text).toContain("상품 입고 후 표시 예정");
    expect(text).toContain("010-6227-7918 · hello@takesuaci.com");
    expect(text).not.toContain("모든 피부");
    // 고시가 다른 접이 칸보다 먼저
    const firstDetails = document.querySelector("details");
    expect(firstDetails).toBe(details);
  });

  it("사용법 → 표시 문구가 정해지기 전에는 칸을 숨긴다", () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <ProductSection />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByText("사용법")).toBeNull();
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

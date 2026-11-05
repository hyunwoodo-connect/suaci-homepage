import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "./page";

// 자리만 본다 — 각 구역의 속은 각자 테스트에서
vi.mock("@/components/home/SiteHeader", () => ({ default: () => <header /> }));
vi.mock("@/components/home/Hero", () => ({ default: () => <section data-testid="hero" /> }));
vi.mock("@/components/home/Story", () => ({ default: () => <section /> }));
vi.mock("@/components/home/Moments", () => ({ default: () => <section /> }));
vi.mock("@/components/home/ProductSection", () => ({
  default: () => <section data-testid="product" />,
}));
vi.mock("@/components/home/SiteFooter", () => ({ default: () => <footer data-testid="footer" /> }));
vi.mock("@/components/home/BuyBar", () => ({ default: () => <div data-testid="buy-bar" /> }));

describe("홈 구역 순서", () => {
  it("사기 바는 제품 뒤·푸터 앞에 놓이고, 푸터가 main 의 마지막", () => {
    render(<Home />);
    const product = screen.getByTestId("product");
    const bar = screen.getByTestId("buy-bar");
    const footer = screen.getByTestId("footer");

    expect(product.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bar.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 푸터가 main 의 마지막 — 아래에 빈 띠가 생기지 않는다
    expect(footer.parentElement?.lastElementChild).toBe(footer);
  });
});

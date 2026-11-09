import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProductShot from "./ProductShot";

describe("ProductShot", () => {
  it("사진 경로 없음 → 아무것도 그리지 않는다('준비 중' 상자 없음)", () => {
    const { container } = render(<ProductShot src={null} alt="병" className="" sizes="100vw" />);
    expect(container.innerHTML).toBe("");
  });

  it("사진 경로 있음 → 그 사진을 alt 와 함께", () => {
    render(
      <ProductShot
        src="/image/product/take-01-main.webp"
        alt="라임바질 페이셜 세럼 미스트 100 ml 병"
        className=""
        sizes="100vw"
      />,
    );
    const img = screen.getByRole("img", { name: "라임바질 페이셜 세럼 미스트 100 ml 병" });
    expect(img.getAttribute("src")).toContain("take-01-main.webp");
  });
});

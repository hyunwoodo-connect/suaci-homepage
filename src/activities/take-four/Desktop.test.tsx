import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { create } from "qrcode";

import Desktop from "./Desktop";

vi.mock("qrcode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("qrcode")>();
  return { ...actual, create: vi.fn(actual.create) };
});

const URL_WITH_PREVIEW = "https://takesuaci.com/events/take-four?preview=abc123";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Desktop", () => {
  it("QR → 넘겨받은 절대 주소(미리보기 토큰 포함)를 담는다", () => {
    render(<Desktop slug="take-four" url={URL_WITH_PREVIEW} />);
    expect(create).toHaveBeenCalledWith(URL_WITH_PREVIEW, expect.anything());
  });

  it("QR → 어두운 칸마다 한 칸짜리 사각형을 그린 SVG", () => {
    const { container } = render(<Desktop slug="take-four" url={URL_WITH_PREVIEW} />);
    const svg = screen.getByRole("img", { name: /QR 코드/ });
    const { size, data } = vi.mocked(create).mock.results[0].value.modules;
    expect(svg).toHaveAttribute("viewBox", `0 0 ${size} ${size}`);
    const d = container.querySelector("svg path")?.getAttribute("d") ?? "";
    expect(d.match(/M/g)?.length).toBe(data.filter(Boolean).length);
  });

  it("주소 글자는 토큰 없이 짧게", () => {
    render(<Desktop slug="take-four" url={URL_WITH_PREVIEW} />);
    expect(screen.getByText("takesuaci.com/events/take-four")).toBeInTheDocument();
  });
});

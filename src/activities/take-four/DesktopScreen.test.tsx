import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { create } from "qrcode";

import DesktopScreen from "./DesktopScreen";

vi.mock("qrcode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("qrcode")>();
  return { ...actual, create: vi.fn(actual.create) };
});

const URL_WITH_PREVIEW = "https://takesuaci.com/events/take-four?preview=abc123";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DesktopScreen", () => {
  it("label → 머리 오른쪽 회차 라벨, 없으면 라벨 없음", () => {
    const { unmount } = render(
      <DesktopScreen slug="take-four" url={URL_WITH_PREVIEW} label="no.01" />,
    );
    expect(screen.getByText("no.01")).toBeInTheDocument();
    unmount();
    render(<DesktopScreen slug="take-four" url={URL_WITH_PREVIEW} />);
    expect(screen.queryByText("no.01")).toBeNull();
  });

  it("QR → 넘겨받은 절대 주소(미리보기 토큰 포함)를 담는다", () => {
    render(<DesktopScreen slug="take-four" url={URL_WITH_PREVIEW} />);
    expect(create).toHaveBeenCalledWith(URL_WITH_PREVIEW, expect.anything());
  });

  it("QR → 어두운 칸마다 한 칸짜리 사각형을 그린 SVG", () => {
    const { container } = render(<DesktopScreen slug="take-four" url={URL_WITH_PREVIEW} />);
    const svg = screen.getByRole("img", { name: /QR 코드/ });
    const { size, data } = vi.mocked(create).mock.results[0].value.modules;
    expect(svg).toHaveAttribute("viewBox", `-4 -4 ${size + 8} ${size + 8}`);
    const d = container.querySelector("svg path")?.getAttribute("d") ?? "";
    expect(d.match(/M/g)?.length).toBe(data.filter(Boolean).length);
  });

  it("QR → 토큰이 길어 칸이 늘어도 여백은 4칸, 크림 바탕이 viewBox 전체", () => {
    const longUrl = `${URL_WITH_PREVIEW}${"x".repeat(120)}`;
    const { container } = render(<DesktopScreen slug="take-four" url={longUrl} />);
    const { size } = vi.mocked(create).mock.results[0].value.modules;
    const [minX, minY, w, h] = (container.querySelector("svg")?.getAttribute("viewBox") ?? "")
      .split(" ")
      .map(Number);
    expect([minX, minY, w - size, h - size]).toEqual([-4, -4, 8, 8]);
    const bg = container.querySelector("svg rect");
    expect(bg).toHaveAttribute("x", "-4");
    expect(bg).toHaveAttribute("width", String(size + 8));
  });

  it("주소 글자는 토큰 없이 짧게", () => {
    render(<DesktopScreen slug="take-four" url={URL_WITH_PREVIEW} />);
    expect(screen.getByText("takesuaci.com/events/take-four")).toBeInTheDocument();
  });
});

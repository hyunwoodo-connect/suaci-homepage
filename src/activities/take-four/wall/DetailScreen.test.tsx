import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import type { StripView } from "./api";
import DetailScreen from "./DetailScreen";
import { isHidden } from "./local";

const api = vi.hoisted(() => ({
  wallApi: { get: vi.fn(), ribbon: vi.fn(), report: vi.fn() },
}));
vi.mock("./api", () => api);

const STRIP: StripView = {
  stripId: "s298",
  serial: 298,
  eventId: "no01",
  ribbons: 48,
  thumbUrl: "https://cdn/s298/thumb.jpg",
  photoUrl: "https://cdn/s298/original.jpg",
  postedAt: Date.parse("2026-12-04T00:00:00Z"),
  postedDtm: "",
};

async function open() {
  await act(async () => {
    render(<DetailScreen slug="take-four" stripId="s298" />);
  });
}

beforeEach(() => {
  api.wallApi.get.mockReset().mockResolvedValue(STRIP);
  api.wallApi.ribbon.mockReset();
  api.wallApi.report.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DetailScreen", () => {
  it("큰 띠(원본)·번호·회차·도장, 닫기 → 벽", async () => {
    await open();
    expect(api.wallApi.get).toHaveBeenCalledWith("s298");
    expect(screen.getByRole("img", { name: "다른 사람들의 네컷" })).toHaveAttribute(
      "src",
      "https://cdn/s298/original.jpg",
    );
    expect(screen.getAllByText("no.0298").length).toBeGreaterThan(0);
    expect(screen.getByText("No.01 · 12.04")).toBeInTheDocument();
    expect(document.querySelector("[data-stamp]")).toHaveTextContent("No.01");
    expect(screen.getByRole("link", { name: "닫기" })).toHaveAttribute(
      "href",
      "/events/take-four/wall",
    );
  });

  it("불러오는 동안 → 불러오는 중", async () => {
    api.wallApi.get.mockReturnValue(new Promise(() => {}));
    await open();
    expect(screen.getByRole("status")).toHaveTextContent("불러오는 중…");
  });

  it("없거나 가려졌으면 → 벽에 없어요 + 벽으로", async () => {
    api.wallApi.get.mockResolvedValue(null);
    await open();
    expect(screen.getByText("이 네컷은 벽에 없어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "벽으로" })).toHaveAttribute(
      "href",
      "/events/take-four/wall",
    );
  });

  it("리본 연타 → 한 번만 보내고 `리본 달았어요 49`", async () => {
    let resolve: (n: number) => void = () => {};
    api.wallApi.ribbon.mockReturnValue(new Promise<number>((r) => (resolve = r)));
    await open();
    const button = screen.getByRole("button", { name: "리본 달기 48" });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    await act(async () => resolve(49));
    expect(api.wallApi.ribbon).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "리본 달았어요 49" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("리본 실패 → `리본 달기 48`로 되돌림", async () => {
    api.wallApi.ribbon.mockRejectedValue(new Error("net"));
    await open();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "리본 달기 48" }));
    });
    expect(screen.getByRole("button", { name: "리본 달기 48" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("신고 → 확인 시트 → 신고하기 → 감사 시트(벽으로)", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "신고" }));
    const sheet = screen.getByRole("dialog", { name: "신고" });
    expect(within(sheet).getByText("이 네컷을 신고할까요?")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "신고하기" }));
    });
    expect(api.wallApi.report).toHaveBeenCalledWith("s298");
    expect(isHidden("s298")).toBe(true);
    expect(screen.getByText("알려 줘서 고마워요")).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByRole("link", { name: "벽으로" }),
    ).toHaveAttribute("href", "/events/take-four/wall");
  });

  it("신고 취소 → 보내지 않고 닫힘", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "신고" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(api.wallApi.report).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("신고 실패 → 시트에 남아 알린다", async () => {
    api.wallApi.report.mockRejectedValue(new Error("net"));
    await open();
    fireEvent.click(screen.getByRole("button", { name: "신고" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "신고하기" }));
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("알려 줘서 고마워요")).toBeNull();
  });
});

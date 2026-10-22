import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ApiClientError } from "@/lib/api";

import PostSheet from "./PostSheet";

const wall = vi.hoisted(() => ({ postStrip: vi.fn() }));
vi.mock("./postStrip", () => wall);
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const CARD_BLOB = new Blob(["card"], { type: "image/jpeg" });

function renderSheet() {
  render(<PostSheet card={CARD_BLOB} slug="take-four" />);
}

beforeEach(() => {
  wall.postStrip.mockReset().mockResolvedValue({ stripId: "01J" });
  router.push.mockReset();
});

afterEach(cleanup);

describe("PostSheet", () => {
  it("벽에 붙이기 → 시트(제목·안내·붙이기·아니요)", async () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "벽에 붙이기" }));
    const sheet = screen.getByRole("dialog", { name: "벽에 붙이기" });
    expect(sheet).toHaveTextContent("벽에 붙일까요?");
    expect(sheet).toHaveTextContent("누구나 볼 수 있어요. 언제든 뗄 수 있어요.");
    expect(screen.getByRole("button", { name: "붙이기" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "아니요" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("붙이기 연타 → 한 번만 보내고, 보내는 중엔 잠근다", async () => {
    let finish: (value: unknown) => void = () => {};
    wall.postStrip.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "벽에 붙이기" }));
    const button = screen.getByRole("button", { name: "붙이기" });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(wall.postStrip).toHaveBeenCalledTimes(1);
    expect(wall.postStrip).toHaveBeenCalledWith(CARD_BLOB);
    expect(screen.getByRole("button", { name: "보내는 중…" })).toBeDisabled();
    await act(async () => finish({ stripId: "01J" }));
  });

  it("실패 → 알림 + 다시 보내기, 다시 보내면 또 보낸다", async () => {
    wall.postStrip.mockRejectedValueOnce(new Error("끊김"));
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "벽에 붙이기" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "붙이기" })));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "연결이 끊겼어요. 네컷은 폰에 그대로 있어요.",
    );
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "다시 보내기" })));
    expect(wall.postStrip).toHaveBeenCalledTimes(2);
    expect(router.push).toHaveBeenCalledWith("/events/take-four/wall?posted=01J");
  });

  it("성공 → 벽으로(posted=stripId)", async () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "벽에 붙이기" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "붙이기" })));
    expect(router.push).toHaveBeenCalledWith("/events/take-four/wall?posted=01J");
  });

  it("하루 한도(429 RATE_LIMITED) → 한도 알림, 다시 보내기 없음, 아니요로 닫힘", async () => {
    wall.postStrip.mockRejectedValueOnce(new ApiClientError("RATE_LIMITED", "한도", 429));
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "벽에 붙이기" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "붙이기" })));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "오늘은 여기까지 붙일 수 있어요. 내일 또 붙여 주세요.",
    );
    expect(screen.queryByRole("button", { name: "다시 보내기" })).toBeNull();
    expect(screen.queryByRole("button", { name: "붙이기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "아니요" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

import type { EventDetail } from "@/types";

import EntranceScreen from "./EntranceScreen";

const storage = vi.hoisted(() => ({ loadLast: vi.fn() }));
vi.mock("./strip/storage", () => storage);

const IOS_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const EVENT = {
  slug: "take-four",
  activityId: "take-four",
  phase: "live",
  switches: {},
} as unknown as EventDetail;

async function renderEntrance() {
  await act(async () => {
    render(
      <EntranceScreen
        event={EVENT}
        userAgent={IOS_SAFARI}
        url="https://takesuaci.com/events/take-four"
      />,
    );
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ResumeCard", () => {
  it("폰에 남은 카드 있음 → 작은 카드 + 보기 →, 마지막 카드 화면으로", async () => {
    storage.loadLast.mockResolvedValue({
      blob: new Blob(["x"], { type: "image/jpeg" }),
      takenAt: new Date(),
    });
    await renderEntrance();
    const card = await screen.findByRole("link", { name: /아까 찍은 네컷.*보기/ });
    expect(card).toHaveAttribute("href", "/events/take-four/result");
    expect(card.querySelector("img")?.getAttribute("src")).toMatch(/^data:image\/jpeg;base64,/);
    expect(screen.getByRole("link", { name: "커튼 열기" })).toBeInTheDocument();
  });

  it("남은 카드 없음(카드 전 띠 기록 포함) → 카드 없음", async () => {
    storage.loadLast.mockResolvedValue(null);
    await renderEntrance();
    expect(screen.queryByText(/아까 찍은 네컷/)).toBeNull();
  });
});

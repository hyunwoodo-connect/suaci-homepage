import { describe, it, expect, vi, afterEach } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

import type { EventDetail } from "@/types";

import { stripCaption } from "../strip/compose";
import LastResult from "./LastResult";

const storage = vi.hoisted(() => ({ loadLast: vi.fn() }));
vi.mock("../strip/storage", () => storage);
const stage = vi.hoisted(() => ({ shipped: { wall: false, entry: false } }));
vi.mock("../stage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../stage")>();
  return {
    ...actual,
    isStageOn: (...[event, name]: Parameters<typeof actual.isStageOn>) =>
      actual.isStageOn(event, name, stage.shipped),
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const EVENT = { slug: "take-four", phase: "ended", switches: {} } as unknown as EventDetail;

async function renderLast(event: EventDetail = EVENT) {
  await act(async () => {
    render(<LastResult event={event} />);
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LastResult", () => {
  it("남은 띠 → 찍던 때 캡션 그대로 완성 화면, 다시 찍기는 부스로", async () => {
    storage.loadLast.mockResolvedValue({
      blob: new Blob(["x"]),
      photos: new Blob(["p"], { type: "image/jpeg" }),
      caption: stripCaption("live", new Date("2026-10-22T05:00:00Z"), "No.01"),
    });
    await renderLast();
    expect(await screen.findByText("No.01 · 10.22")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다시 찍기" })).toHaveAttribute(
      "href",
      "/events/take-four/booth",
    );
  });

  it("남은 띠 없음(사생활 보호 모드 등) → 안내 + 커튼 열기", async () => {
    storage.loadLast.mockResolvedValue(null);
    await renderLast();
    expect(screen.getByText(/아까 찍은 네컷이 없어요/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "커튼 열기" })).toHaveAttribute(
      "href",
      "/events/take-four/booth",
    );
  });

  it("2단계가 나왔고 switches.wall → 남은 띠에도 벽에 붙이기", async () => {
    stage.shipped = { wall: true, entry: false };
    try {
      storage.loadLast.mockResolvedValue({
        blob: new Blob(["x"]),
        photos: new Blob(["p"], { type: "image/jpeg" }),
        caption: stripCaption("live", new Date("2026-10-22T05:00:00Z"), "No.01"),
      });
      await renderLast({ ...EVENT, switches: { wall: true } } as EventDetail);
      expect(await screen.findByRole("button", { name: "벽에 붙이기" })).toBeInTheDocument();
    } finally {
      stage.shipped = { wall: false, entry: false };
    }
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";

// 방(3D)은 대역: 화면이 넘긴 알림 함수를 잡아 두고, 화면이 부르는 것만 센다
const { room, openAvatarRoom, fetchManifest } = vi.hoisted(() => {
  const room = { dress: vi.fn(), finish: vi.fn(), stop: vi.fn() };
  return { room, openAvatarRoom: vi.fn(), fetchManifest: vi.fn() };
});
vi.mock("@/lib/avatar/room", () => ({ openAvatarRoom }));
vi.mock("@/lib/asset-kit/manifest", () => ({ fetchManifest }));

import AvatarStage from "./AvatarStage";

/** 방이 화면에 알리는 것(openAvatarRoom 의 세 번째 인자) */
interface Handlers {
  onReady(): void;
  onToggle(isOpen: boolean): void;
  onFail(): void;
}

async function renderStage() {
  let utils!: ReturnType<typeof render>;
  await act(async () => {
    utils = render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <AvatarStage />
      </NextIntlClientProvider>,
    );
  });
  return utils;
}

function handlers(): Handlers {
  return openAvatarRoom.mock.calls[0][2] as Handlers;
}

const dressButton = () => screen.getByRole("button", { name: "꾸미기" });

beforeEach(() => {
  vi.clearAllMocks();
  fetchManifest.mockResolvedValue({ version: "v9", assets: {} });
  openAvatarRoom.mockReturnValue(room);
});

describe("AvatarStage", () => {
  it("받는 동안 → 불러오는 중을 알리고 꾸미기는 누를 수 없다", async () => {
    await renderStage();
    expect(screen.getByRole("status", { name: "아바타를 불러오는 중" })).toBeTruthy();
    expect(dressButton()).toHaveProperty("disabled", true);
  });

  it("아바타가 서면 → 꾸미기를 누를 수 있고, 누르면 방에 옷장을 열라고 한다", async () => {
    await renderStage();
    act(() => handlers().onReady());
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(dressButton());
    expect(room.dress).toHaveBeenCalledTimes(1);
  });

  it("옷장이 열리면 → 같은 틀이 화면을 덮는 대화상자가 되고 뒤 페이지는 구르지 않는다", async () => {
    await renderStage();
    act(() => handlers().onReady());
    act(() => handlers().onToggle(true));
    expect(screen.getByRole("dialog", { name: "아바타 꾸미기" })).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("옷장이 닫히면 → 대화상자가 아니고 뒤 페이지가 다시 구른다", async () => {
    await renderStage();
    act(() => handlers().onReady());
    act(() => handlers().onToggle(true));
    act(() => handlers().onToggle(false));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("꾸미는 중에 Esc → 방에 옷장을 닫으라고 한다", async () => {
    await renderStage();
    act(() => handlers().onReady());
    act(() => handlers().onToggle(true));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(room.finish).toHaveBeenCalledTimes(1);
  });

  it("꾸미는 중이 아닐 때 Esc → 아무 일도 없다", async () => {
    await renderStage();
    act(() => handlers().onReady());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(room.finish).not.toHaveBeenCalled();
  });

  it("몸을 받지 못하면 → 못 불러왔다고 알리고 꾸미기는 누를 수 없다", async () => {
    await renderStage();
    act(() => handlers().onFail());
    expect(screen.getByRole("alert").textContent).toBe("아바타를 불러오지 못했어요.");
    expect(dressButton()).toHaveProperty("disabled", true);
  });

  it("목록을 받지 못하면 → 방을 열지 않고 못 불러왔다고 알린다", async () => {
    fetchManifest.mockRejectedValue(new Error("끊김"));
    await renderStage();
    expect(openAvatarRoom).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("화면을 떠나면 → 방을 치운다", async () => {
    const { unmount } = await renderStage();
    unmount();
    expect(room.stop).toHaveBeenCalledTimes(1);
  });
});

import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { recordClear } from "@/lib/play-record";

const { loadAvatarManifest } = vi.hoisted(() => ({ loadAvatarManifest: vi.fn() }));
vi.mock("@/lib/avatar/bundle", () => ({
  loadAvatarManifest,
  avatarAssetUrl: (manifest: { assets: Record<string, string> }, key: string) =>
    manifest.assets[key] ?? null,
}));

import RewardLine from "./RewardLine";

async function renderLine() {
  let utils!: ReturnType<typeof render>;
  await act(async () => {
    utils = render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <RewardLine eventId="teum01" item="board" name="스케이트보드" />
      </NextIntlClientProvider>,
    );
  });
  return utils;
}

beforeEach(() => {
  loadAvatarManifest.mockReset();
  loadAvatarManifest.mockResolvedValue({ assets: { thumb_board: "https://cdn.test/board.webp" } });
});

describe("RewardLine", () => {
  it("아직 깨지 않았으면 → '깨면 받는 옷'과 그 옷의 이름", async () => {
    await renderLine();
    expect([!!screen.getByText("깨면 받는 옷"), !!screen.getByText("스케이트보드")]).toEqual([
      true,
      true,
    ]);
  });

  it("이 기기에서 깼으면 → '받은 옷'", async () => {
    recordClear({ eventId: "teum01", activityId: "teum", at: 1 });
    await renderLine();
    expect([!!screen.getByText("받은 옷"), screen.queryByText("깨면 받는 옷")]).toEqual([
      true,
      null,
    ]);
  });

  it("옷의 그림 → 옷장 칸 그림을 받아 보인다", async () => {
    const { container } = await renderLine();
    const picture = container.querySelector<HTMLElement>('[aria-hidden="true"]')!;
    expect(picture.style.backgroundImage).toContain("https://cdn.test/board.webp");
  });

  it("그림을 받지 못해도 → 이름은 그대로 보인다", async () => {
    loadAvatarManifest.mockRejectedValue(new Error("끊김"));
    await renderLine();
    expect(screen.getByText("스케이트보드")).toBeTruthy();
  });
});

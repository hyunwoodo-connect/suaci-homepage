import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BoxPrize } from "@/lib/prize-box";

vi.mock("@/lib/avatar/bundle", () => ({
  // 받는 중으로 둔다(그림이 오기 전의 칸 — 이름은 그대로 보인다)
  loadAvatarManifest: () => new Promise(() => {}),
  avatarAssetUrl: () => null,
}));

import PrizeBoxes, { SHAKE_MS } from "./PrizeBoxes";

const ITEM: BoxPrize = { kind: "item", item: "board" };
const MIST: BoxPrize = { kind: "mist" };

function mount(prizes: BoxPrize[]) {
  const on = { onAgain: vi.fn(), onLeave: vi.fn(), onClose: vi.fn() };
  render(<PrizeBoxes prizes={prizes} {...on} />);
  return on;
}

/** 박스가 흔들리고 펑 터질 때까지 */
function waitPop() {
  act(() => {
    vi.advanceTimersByTime(SHAKE_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PrizeBoxes", () => {
  it("처음 → clear! 와 박스 수만큼의 박스", () => {
    mount([ITEM, MIST]);
    expect([
      !!screen.getByText("clear!"),
      screen.getAllByRole("button", { name: /랜덤박스 \d 열기/ }).length,
    ]).toEqual([true, 2]);
  });

  it("박스를 누르면 → 흔드는 동안은 아직 이름이 없고, 펑 뒤에 나온 것의 이름", () => {
    mount([ITEM]);
    fireEvent.click(screen.getByRole("button", { name: "랜덤박스 1 열기" }));
    const during = screen.queryByText("스케이트보드");
    waitPop();
    expect([during, !!screen.getByText("스케이트보드")]).toEqual([null, true]);
  });

  it("미스트가 나오면 → 바탕이 먹색으로 바뀐다", () => {
    mount([MIST]);
    fireEvent.click(screen.getByRole("button", { name: "랜덤박스 1 열기" }));
    waitPop();
    const scene = screen.getByText("진짜 미스트").parentElement!;
    expect(scene.className).toContain("bg-ink");
  });

  it("다음 → 다음 박스를 열고, 마지막 뒤에는 받은 것 모두와 다시 하기", () => {
    mount([ITEM, MIST]);
    fireEvent.click(screen.getByRole("button", { name: "랜덤박스 1 열기" }));
    waitPop();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    waitPop();
    const second = !!screen.getByText("진짜 미스트");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    const won = screen.getByRole("list", { name: "받은 것" }).textContent;
    expect([second, won, !!screen.getByRole("button", { name: "다시 하기" })]).toEqual([
      true,
      "스케이트보드진짜 미스트",
      true,
    ]);
  });

  it("다 연 뒤 다시 하기 · 나가기 · 닫기 → 누른 것을 알린다", () => {
    const on = mount([]);
    fireEvent.click(screen.getByRole("button", { name: "다시 하기" }));
    fireEvent.click(screen.getByRole("button", { name: "나가기" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect([on.onAgain, on.onLeave, on.onClose].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });
});

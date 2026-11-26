import { describe, expect, it } from "vitest";

import { Closet } from "./closet";
import { closetLabels } from "./closet-labels";
import { DEFAULT_LOOK } from "./outfit";

// 옷장 하나와, 눌린 것을 적는 칸
function mount(locks: Map<string, string>) {
  const parent = document.createElement("div");
  const picked: string[] = [];
  const closet = new Closet(
    parent,
    () => null,
    {
      onOpen() {},
      onPick: (tab, value) => picked.push(`${tab}:${value}`),
      onUndo() {},
      onShuffle() {},
      onDone() {},
      onTurn() {},
    },
    { hasWearButton: false, labels: closetLabels("ko"), locks: () => locks },
  );
  const tab = (name: string) =>
    [...parent.querySelectorAll("button")].find((b) => b.textContent === name)!;
  const cell = (value: string) =>
    [...parent.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.dataset.value === value,
    )!;
  const tip = () => parent.querySelector('[aria-live="polite"]')!.textContent;
  return { parent, closet, picked, tab, cell, tip };
}

describe("Closet 아직 받지 못한 칸", () => {
  it("잠긴 칸 → 고를 수 없다고 알리고(읽는 이름에 받는 곳), 눌러도 고르지 않고 받는 곳을 적는다", () => {
    const { closet, picked, tab, cell, tip } = mount(new Map([["board", "틈"]]));
    closet.show(true, { ...DEFAULT_LOOK });
    tab("보드").click();
    const board = cell("board");
    board.click();
    expect([board.getAttribute("aria-disabled"), board.getAttribute("aria-label")]).toEqual([
      "true",
      "스케이트보드 — '틈'에서 받아요",
    ]);
    expect([picked, tip()]).toEqual([[], "'틈'에서 받아요"]);
    closet.dispose();
  });

  it("받은 뒤(잠금이 풀리면) 다시 그리면 → 고를 수 있다", () => {
    const locks = new Map([["board", "틈"]]);
    const { closet, picked, tab, cell } = mount(locks);
    closet.show(true, { ...DEFAULT_LOOK });
    locks.delete("board");
    tab("보드").click();
    cell("board").click();
    expect([cell("board").getAttribute("aria-disabled"), picked]).toEqual([null, ["board:board"]]);
    closet.dispose();
  });

  it("이미 입고 있는 것 → 잠겨 있어도 잠긴 칸으로 보이지 않는다", () => {
    const { closet, tab, cell } = mount(new Map([["board", "틈"]]));
    closet.show(true, { ...DEFAULT_LOOK, board: "board" });
    tab("보드").click();
    expect(cell("board").getAttribute("aria-disabled")).toBeNull();
    closet.dispose();
  });

  it("옷장을 다시 열면 → 안내 자리는 밀어서 돌리라는 말로 돌아온다", () => {
    const { closet, tab, cell, tip } = mount(new Map([["board", "틈"]]));
    closet.show(true, { ...DEFAULT_LOOK });
    tab("보드").click();
    cell("board").click();
    closet.show(false, { ...DEFAULT_LOOK });
    closet.show(true, { ...DEFAULT_LOOK });
    expect(tip()).toBe("밀어서 돌려 봐");
    closet.dispose();
  });
});

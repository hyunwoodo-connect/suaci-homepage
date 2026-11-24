import { describe, expect, it } from "vitest";

import { PixelBudget } from "./pixelBudget";

/** 프레임 간격 ms 를 n 번 알리고, 그사이 바뀐 배율들을 모은다 */
function run(budget: PixelBudget, ms: number, n: number): number[] {
  const changes: number[] = [];
  for (let i = 0; i < n; i++) {
    const next = budget.feed(ms);
    if (next !== null) changes.push(next);
  }
  return changes;
}

describe("PixelBudget", () => {
  it("프레임이 제때 나오면(16.7ms) → 배율을 건드리지 않는다", () => {
    const budget = new PixelBudget(2);
    expect(run(budget, 16.7, 2000)).toEqual([]);
  });

  it("시작 직후의 느린 프레임(불러오는 동안) → 세지 않는다", () => {
    const budget = new PixelBudget(2);
    expect(run(budget, 40, 180)).toEqual([]);
    expect(run(budget, 16.7, 1000)).toEqual([]);
  });

  it("잠깐(한 번 재는 동안만) 느렸다 → 낮추지 않는다", () => {
    const budget = new PixelBudget(2);
    run(budget, 16.7, 180);
    expect(run(budget, 30, 90)).toEqual([]);
    expect(run(budget, 16.7, 500)).toEqual([]);
  });

  it("두 번 이어서 재도 느리다 → 한 단계 낮춘다(2 → 1.5)", () => {
    const budget = new PixelBudget(2);
    run(budget, 30, 180);
    expect(run(budget, 30, 180)).toEqual([1.5]);
  });

  it("낮췄더니 나아졌다 → 그대로 두고, 그 뒤로 괜찮으면 더 낮추지 않는다", () => {
    const budget = new PixelBudget(2);
    expect(run(budget, 30, 360)).toEqual([1.5]);
    expect(run(budget, 18, 2000)).toEqual([]);
  });

  it("낮춰서 나아졌지만 아직 느리다 → 한 단계 더(1.5 → 1.25), 거기가 바닥이다", () => {
    const budget = new PixelBudget(2);
    run(budget, 40, 360);
    // 낮춘 뒤 26ms: 40ms 보다는 나아졌지만 여전히 느리다
    const changes = run(budget, 26, 45 + 90 + 180);
    expect(changes).toEqual([1.25]);
    // 1.25 에서도 나아졌지만 느린 채면 더 낮출 단계가 없다
    expect(run(budget, 22.5, 45 + 90)).toEqual([]);
    expect(run(budget, 25, 3000)).toEqual([]);
  });

  it("낮춰도 나아지지 않는다(기기가 초당 30장으로 묶어 둠) → 되돌리고 그 뒤로는 건드리지 않는다", () => {
    const budget = new PixelBudget(2);
    expect(run(budget, 33.3, 360)).toEqual([1.5]);
    expect(run(budget, 33.3, 45 + 90)).toEqual([2]);
    expect(run(budget, 33.3, 5000)).toEqual([]);
  });

  it("한참 멈춘 프레임(탭이 가려졌다 돌아옴) → 세지 않는다", () => {
    const budget = new PixelBudget(2);
    run(budget, 16.7, 180);
    const changes: (number | null)[] = [];
    for (let i = 0; i < 400; i++) changes.push(budget.feed(16.7), budget.feed(3000));
    expect(changes.every((next) => next === null)).toBe(true);
  });

  it("처음부터 낮은 배율의 기기(1) → 낮출 단계가 없다", () => {
    const budget = new PixelBudget(1);
    expect(run(budget, 40, 3000)).toEqual([]);
  });

  it("배율 1.5 로 시작한 기기 → 1.25 까지만", () => {
    const budget = new PixelBudget(1.5);
    run(budget, 40, 180);
    expect(run(budget, 40, 180)).toEqual([1.25]);
  });
});

import { describe, expect, it } from "vitest";

import { Fifo, Ring } from "./pool";

describe("Ring", () => {
  it("next → 차례로 돌려 쓴다", () => {
    const r = new Ring(["a", "b", "c"]);
    expect([r.next(), r.next(), r.next(), r.next()]).toEqual(["a", "b", "c", "a"]);
  });

  it("firstOr → 조건에 맞는 첫 것, 없으면 맨 앞", () => {
    const r = new Ring([1, 2, 3]);
    expect(r.firstOr((x) => x > 1)).toBe(2);
    expect(r.firstOr((x) => x > 9)).toBe(1);
  });
});

describe("Fifo", () => {
  const make = () => ({ id: 0 });

  it("가득 차면 → 가장 오래된 것을 지우고 넣는다(빛 방울 60 개처럼)", () => {
    const f = new Fifo(3, make);
    for (let i = 1; i <= 5; i++) f.push().id = i;
    expect(f.size).toBe(3);
    expect([f.at(0).id, f.at(1).id, f.at(2).id]).toEqual([3, 4, 5]);
  });

  it("sweep → 지운 것을 빼고 남은 순서는 그대로", () => {
    const f = new Fifo(5, make);
    for (let i = 1; i <= 5; i++) f.push().id = i;
    f.sweep((x) => x.id % 2 === 1);
    expect(f.size).toBe(3);
    expect([f.at(0).id, f.at(1).id, f.at(2).id]).toEqual([1, 3, 5]);
  });

  it("sweep 뒤 push → 비운 칸을 다시 쓴다(새로 만들지 않는다)", () => {
    const f = new Fifo(2, make);
    const a = f.push(),
      b = f.push();
    f.sweep(() => false);
    const c = f.push(),
      d = f.push();
    expect(new Set([c, d])).toEqual(new Set([a, b]));
  });
});

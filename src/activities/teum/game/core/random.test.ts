import { describe, expect, it } from "vitest";

import { Random } from "./random";

describe("Random", () => {
  it("같은 씨앗 → 같은 흐름", () => {
    const a = new Random(42),
      b = new Random(42);
    const xs = [a.next(), a.next(), a.next()];
    expect([b.next(), b.next(), b.next()]).toEqual(xs);
  });

  it("mulberry32 → 시제품 시험 도구와 같은 첫 값(씨앗 42)", () => {
    expect(new Random(42).next()).toBeCloseTo(0.6011037519201636, 12);
  });

  it("range → a 이상 b 미만", () => {
    const r = new Random(7);
    for (let i = 0; i < 200; i++) {
      const x = r.range(2, 5);
      expect(x).toBeGreaterThanOrEqual(2);
      expect(x).toBeLessThan(5);
    }
  });

  it("fork → 이름이 같으면 같은 흐름, 다르면 다른 흐름이고 부모는 그대로", () => {
    const root = new Random(9);
    const a = root.fork("fx").next(),
      b = root.fork("fx").next(),
      c = root.fork("creatures").next();
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    expect(root.next()).toBe(new Random(9).next());
  });
});

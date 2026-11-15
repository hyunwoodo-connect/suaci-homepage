import { describe, expect, it } from "vitest";

import { openLocally } from "./judge";

// 정해 둔 수열을 차례로 내는 난수
function sequence(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("openLocally", () => {
  it("확률 구간: 0.01 실물 · 0.1 한정 친구 · 0.3 조각 · 0.9 꽝(한 개만 열면 구제 없음)", () => {
    for (const [r, prize] of [
      [0.01, "physical"],
      [0.1, "species"],
      [0.3, "part"],
      [0.9, "blank"],
    ] as const) {
      expect(openLocally({ count: 1, sure: 0 }, sequence(r)).prizes).toEqual([prize]);
    }
  });

  it("꽝 없는 상자가 남아 있으면 → 꽝 대신 좋은 것, 하나 쓴다", () => {
    const result = openLocally({ count: 1, sure: 2 }, sequence(0.9, 0.5));
    expect(result).toEqual({ prizes: ["part"], sure: 1 });
  });

  it("둘 이상 열면서 끝까지 꽝 → 마지막 상자는 좋은 것", () => {
    const result = openLocally({ count: 3, sure: 0 }, sequence(0.9, 0.9, 0.9, 0.2));
    expect(result.prizes).toEqual(["blank", "blank", "species"]);
  });

  it("앞에서 하나라도 나왔으면 → 마지막도 그대로 꽝일 수 있다", () => {
    const result = openLocally({ count: 2, sure: 0 }, sequence(0.3, 0.9));
    expect(result.prizes).toEqual(["part", "blank"]);
  });
});

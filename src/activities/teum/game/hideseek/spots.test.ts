import { describe, expect, it } from "vitest";

import { HIDE_ROUNDS, HIDE_SPOTS, placeOf, roundSpots, startPoint } from "./spots";

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe("숨는 자리", () => {
  it("후보 → 뒤에 숨기 여덟, 높이 숨기 넷이고 모두 마을 중심 100m 안에 선다", () => {
    const kinds = HIDE_SPOTS.map((s) => s.kind);
    expect(kinds.filter((k) => k === "behind")).toHaveLength(8);
    expect(kinds.filter((k) => k === "high")).toHaveLength(4);
    for (const s of HIDE_SPOTS)
      expect(Math.hypot(placeOf(s).x, placeOf(s).y), s.id).toBeLessThan(100);
  });

  it("묶음마다 → 넷이고, 서로 30m 넘게 떨어지고, 높이 숨기는 많아야 하나", () => {
    for (let set = 1; set <= HIDE_ROUNDS.length; set++) {
      const spots = roundSpots(set);
      expect(spots).toHaveLength(4);
      expect(spots.filter((s) => s.kind === "high").length).toBeLessThanOrEqual(1);
      const places = spots.map(placeOf);
      for (let i = 0; i < places.length; i++)
        for (let j = i + 1; j < places.length; j++)
          expect(
            dist(places[i], places[j]),
            `${set}: ${spots[i].id}–${spots[j].id}`,
          ).toBeGreaterThan(30);
    }
  });

  it("묶음마다 → 출발 자리에서 25m 안에 뒤에 숨은 상자가 하나 있다", () => {
    const s = startPoint();
    for (let set = 1; set <= HIDE_ROUNDS.length; set++) {
      const easy = roundSpots(set).filter((o) => o.kind === "behind" && dist(placeOf(o), s) < 25);
      expect(easy.length, String(set)).toBeGreaterThanOrEqual(1);
    }
  });

  it("묶음 셋 → 서로 다르고, 넘으면 처음으로 돈다", () => {
    const ids = (set: number) =>
      roundSpots(set)
        .map((s) => s.id)
        .join();
    expect(new Set([ids(1), ids(2), ids(3)]).size).toBe(3);
    expect(ids(4)).toBe(ids(1));
  });

  it("뒤에 숨기 → 출발 자리에서 가린 것보다 멀고, 상자 너비의 15% 만큼만 옆으로 비어져 나온다", () => {
    const s = startPoint();
    for (const spot of HIDE_SPOTS) {
      if (spot.kind !== "behind") continue;
      const p = placeOf(spot);
      expect(dist(p, s), spot.id).toBeGreaterThan(dist(spot, s));
      // 출발에서 가린 것으로 가는 줄에서 옆으로 떨어진 거리 = 반너비 - 상자 반너비 + 상자 너비의 15%
      const ux = (spot.x - s.x) / dist(spot, s),
        uy = (spot.y - s.y) / dist(spot, s);
      const side = Math.abs((p.x - spot.x) * -uy + (p.y - spot.y) * ux);
      expect(side, spot.id).toBeCloseTo(spot.w - 0.35 + 0.105, 5);
    }
  });
});

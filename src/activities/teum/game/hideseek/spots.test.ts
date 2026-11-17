import { describe, expect, it } from "vitest";

import { BOX_HALF, HIDE_ROUNDS, HIDE_SPOTS, placeOf, roundSpots, startPoint } from "./spots";
import type { BehindSpot, HideSpot, HighSpot } from "./tuning";
import { HIDE, PLACED_DISGUISES } from "./tuning";

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const isHidden = (s: HideSpot): s is BehindSpot | HighSpot => s.kind !== "disguise";

// 판이 시작할 때 자리가 정해지는 상자의 평면 자리(뒤·높이 숨기와 놓을 자리가 정해진 아닌 척). 나머지는 null
const fixedPlace = (s: HideSpot) => {
  if (isHidden(s)) return placeOf(s);
  return PLACED_DISGUISES.includes(s.as) ? { x: s.x, y: s.y } : null;
};

describe("숨는 자리", () => {
  it("후보 → 뒤에 숨기 다섯, 높이 숨기 셋이고 가리는 것은 모두 무대 반경 안에 있다", () => {
    const kinds = HIDE_SPOTS.map((s) => s.kind);
    expect(kinds.filter((k) => k === "behind")).toHaveLength(5);
    expect(kinds.filter((k) => k === "high")).toHaveLength(3);
    for (const s of HIDE_SPOTS) expect(Math.hypot(s.x, s.y), s.id).toBeLessThanOrEqual(70);
    expect(HIDE.stage.radius).toBe(70);
  });

  it("아닌 척하기 → 다섯 가지 넘게, 내 줄에 끼기는 꼭 있다", () => {
    const kinds = new Set(HIDE_SPOTS.flatMap((s) => (s.kind === "disguise" ? [s.as] : [])));
    expect(kinds.size).toBeGreaterThanOrEqual(5);
    expect(kinds.has("line")).toBe(true);
  });

  it("묶음마다 → 넷이고, 자리가 정해진 상자끼리 겹치지 않게 6m 넘게 떨어진다", () => {
    for (let set = 1; set <= HIDE_ROUNDS.length; set++) {
      const spots = roundSpots(set);
      expect(spots).toHaveLength(4);
      const placed = spots.map((s) => ({ id: s.id, at: fixedPlace(s) })).filter((p) => p.at);
      for (let i = 0; i < placed.length; i++)
        for (let j = i + 1; j < placed.length; j++)
          expect(
            dist(placed[i].at!, placed[j].at!),
            `${set}: ${placed[i].id}–${placed[j].id}`,
          ).toBeGreaterThan(6);
    }
  });

  it("묶음마다 → 둘은 아닌 척(첫 묶음은 하나), 첫 상자는 출발 자리 30m 안의 뒤에 숨기", () => {
    const s = startPoint();
    for (let set = 1; set <= HIDE_ROUNDS.length; set++) {
      const spots = roundSpots(set),
        first = spots[0],
        disguised = spots.filter((x) => x.kind === "disguise").length;
      expect(disguised, String(set)).toBe(set === 1 ? 1 : 2);
      expect(first.kind, String(set)).toBe("behind");
      if (first.kind === "behind") expect(dist(placeOf(first), s), String(set)).toBeLessThan(30);
    }
  });

  it("묶음들 → 서로 다르고, 넘으면 처음으로 돈다", () => {
    const ids = (set: number) =>
      roundSpots(set)
        .map((s) => s.id)
        .join();
    const all = HIDE_ROUNDS.map((_, i) => ids(i + 1));
    expect(new Set(all).size).toBe(HIDE_ROUNDS.length);
    expect(ids(HIDE_ROUNDS.length + 1)).toBe(ids(1));
  });

  it("뒤에 숨기 → 출발 자리에서 가린 것보다 멀고, 상자 너비의 showShare 만큼만 옆으로 비어져 나온다", () => {
    const s = startPoint();
    for (const spot of HIDE_SPOTS) {
      if (spot.kind !== "behind") continue;
      const p = placeOf(spot);
      expect(dist(p, s), spot.id).toBeGreaterThan(dist(spot, s));
      // 출발에서 가린 것으로 가는 줄에서 옆으로 떨어진 거리 = 반너비 - 상자 반너비 + 상자 너비 × showShare
      const ux = (spot.x - s.x) / dist(spot, s),
        uy = (spot.y - s.y) / dist(spot, s);
      const side = Math.abs((p.x - spot.x) * -uy + (p.y - spot.y) * ux);
      expect(side, spot.id).toBeCloseTo(spot.w - BOX_HALF + 2 * BOX_HALF * HIDE.box.showShare, 5);
    }
  });

  it("첫 판의 첫 상자 → 보통보다 더 많이 비어져 나온다(리본과 귀를 다 내놓는다)", () => {
    const s = startPoint(),
      first = roundSpots(1)[0];
    if (first.kind !== "behind") throw new Error("첫 상자는 뒤에 숨기");
    const sideOf = (p: { x: number; y: number }) => {
      const ux = (first.x - s.x) / dist(first, s),
        uy = (first.y - s.y) / dist(first, s);
      return Math.abs((p.x - first.x) * -uy + (p.y - first.y) * ux);
    };
    const usual = sideOf(placeOf(first)),
      worst = sideOf(placeOf(first, HIDE.start.firstShowShare));
    expect(HIDE.start.firstShowShare).toBeGreaterThan(HIDE.box.showShare);
    expect(worst).toBeGreaterThan(usual);
  });
});

describe("판의 생물", () => {
  it("손님 → 무대 반경 안에 열둘 넘게, 여섯 종 넘게, 도움 여섯이 한 무리씩", () => {
    const count = HIDE.guests.reduce((n, g) => n + g.count, 0);
    expect(count).toBeGreaterThanOrEqual(12);
    expect(new Set(HIDE.guests.map((g) => g.species)).size).toBeGreaterThanOrEqual(6);
    const helps = HIDE.guests.flatMap((g) => (g.help ? [g.help] : []));
    expect(new Set(helps).size).toBe(6);
  });

  it("앉을 자리 → 출발 30m 안에 셋 넘게(첫 판에는 토끼가 그중 가장 가까운 자리)", () => {
    const start = startPoint();
    const near = HIDE.seats.filter((seat) => dist(seat, start) <= 30);
    expect(near.length).toBeGreaterThanOrEqual(3);
  });

  it("앉을 자리 → 숨는 자리·놓을 자리가 정해진 아닌 척에서 10m 넘게 떨어진다", () => {
    for (const seat of HIDE.seats)
      for (const spot of HIDE_SPOTS) {
        const at = fixedPlace(spot);
        const label = `(${seat.x},${seat.y})–${spot.id}`;
        expect(dist(seat, spot), label).toBeGreaterThanOrEqual(10);
        if (at) expect(dist(seat, at), label).toBeGreaterThanOrEqual(10);
      }
  });

  it("하늘을 도는 무리 → 비행 높이 ±6m 안에서 돈다(누를 수 있는 높이)", () => {
    for (const g of HIDE.guests) if (g.alt !== null) expect(g.alt).toBeLessThanOrEqual(6);
  });
});

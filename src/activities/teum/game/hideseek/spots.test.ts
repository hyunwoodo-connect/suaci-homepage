import { describe, expect, it } from "vitest";

import { BOX_HALF, HIDE_ROUNDS, HIDE_SPOTS, placeOf, roundSpots, startPoint } from "./spots";
import { HIDE } from "./tuning";

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe("숨는 자리", () => {
  it("후보 → 뒤에 숨기 다섯, 높이 숨기 셋이고 가리는 것은 모두 무대 반경 안에 있다", () => {
    const kinds = HIDE_SPOTS.map((s) => s.kind);
    expect(kinds.filter((k) => k === "behind")).toHaveLength(5);
    expect(kinds.filter((k) => k === "high")).toHaveLength(3);
    for (const s of HIDE_SPOTS) expect(Math.hypot(s.x, s.y), s.id).toBeLessThanOrEqual(70);
    expect(HIDE.stage.radius).toBe(70);
  });

  it("묶음마다 → 넷이고, 상자끼리 겹치지 않게 6m 넘게 떨어진다", () => {
    for (let set = 1; set <= HIDE_ROUNDS.length; set++) {
      const spots = roundSpots(set);
      expect(spots).toHaveLength(4);
      const places = spots.map((s) => placeOf(s));
      for (let i = 0; i < places.length; i++)
        for (let j = i + 1; j < places.length; j++)
          expect(
            dist(places[i], places[j]),
            `${set}: ${spots[i].id}–${spots[j].id}`,
          ).toBeGreaterThan(6);
    }
  });

  it("묶음마다 → 첫 상자는 출발 자리 30m 안의 뒤에 숨기(첫 판에 '제일 못 숨은 놈'이 된다)", () => {
    const s = startPoint();
    for (let set = 1; set <= HIDE_ROUNDS.length; set++) {
      const first = roundSpots(set)[0];
      expect(first.kind, String(set)).toBe("behind");
      expect(dist(placeOf(first), s), String(set)).toBeLessThan(30);
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
  // 무리의 모든 생물이 그 안에 드는 거리: 가운데까지의 거리 + 도는 반지름(땅 위 무리는 둘러선 반지름 2.8m)
  const reachFrom = (from: { x: number; y: number }) =>
    HIDE.guests.map((g) => ({ count: g.count, far: dist(g, from) + (g.orbit ?? 2.8) }));

  it("판 시작 → 출발 자리 30m 안에 둘 넘게, 무대 반경 안에 다섯 넘게 있다", () => {
    const near = reachFrom(startPoint()).filter((g) => g.far <= 30),
      onStage = reachFrom({ x: 0, y: 0 }).filter((g) => g.far <= HIDE.stage.radius);
    const count = (list: { count: number }[]) => list.reduce((n, g) => n + g.count, 0);
    expect(count(near)).toBeGreaterThanOrEqual(2);
    expect(count(onStage)).toBeGreaterThanOrEqual(5);
  });

  it("하늘을 도는 무리 → 비행 높이 ±6m 안에서 돈다(잡을 수 있는 높이)", () => {
    for (const g of HIDE.guests) if (g.alt !== null) expect(g.alt).toBeLessThanOrEqual(6);
  });
});

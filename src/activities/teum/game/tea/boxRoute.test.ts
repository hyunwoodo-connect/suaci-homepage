import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { Router } from "./boxRoute";
import { placeSpots, SPOT_SPECS } from "./spots";
import type { Spot } from "./spots";
import { StandShape } from "./stand";
import { TEA } from "./teaTuning";

const stand = new StandShape(TEA);
const spots = placeSpots(stand, SPOT_SPECS);
const top = new THREE.Vector3(0, stand.topY + 1.6, 0);
const router = new Router(stand, top);

function spot(tier: number, mount = "top"): Spot {
  const found = spots.find((s) => s.tier === tier && s.mount === mount);
  if (!found) throw new Error(`${tier}층 ${mount} 자리가 없다`);
  return found;
}

// 길의 점 가운데 기둥을 타는 점들
function climbPoints(points: { pos: THREE.Vector3; move: string }[]) {
  return points.filter((p) => p.move === "climb");
}

describe("Router(상자 전용 길 — 기획서 v3.1 3장)", () => {
  it("땅 → 1단: 기둥을 타고 오르고, 끝은 1단의 그 숨는 자리", () => {
    const from = spot(0),
      to = spot(1);
    const route = router.between(from, to);
    const end = route.points[route.points.length - 1].pos;
    expect(end.distanceTo(to.base)).toBeLessThan(1e-6);
    const climbs = climbPoints(route.points);
    expect(climbs.length).toBeGreaterThan(3);
    // 기둥을 탈 때는 접시 틈(기둥과 접시 사이) 안을 지난다 — 접시를 뚫지 않는다
    for (const p of climbs) {
      const rho = Math.hypot(p.pos.x, p.pos.z);
      expect(rho).toBeGreaterThan(stand.columnR);
      expect(rho).toBeLessThan(stand.plates[0].holeR);
    }
  });

  it("한 칸 옮기는 길은 몰래 이동 빠르기(초속 4m)로 5~16초 — 땅 정원의 먼 자리는 길다", () => {
    const route = router.between(spot(1), spot(2));
    const seconds = route.length / TEA.sneak.speed;
    expect(seconds).toBeGreaterThan(3);
    expect(seconds).toBeLessThan(16);
  });

  it("3단 → 꼭대기: 끝은 찜 기둥", () => {
    const route = router.between(spot(3), null);
    const end = route.points[route.points.length - 1].pos;
    expect(end.distanceTo(top)).toBeLessThan(1e-6);
  });

  it("몰래 이동 중 들키면 → 지금 자리에서 꼭대기까지 달아나는 길(처음은 지금 자리)", () => {
    const route = router.between(spot(0), spot(1));
    const s = route.length * 0.3;
    const here = new THREE.Vector3(),
      up = new THREE.Vector3();
    route.sample(s, here, up);
    const flee = router.fleeFrom(route, s);
    expect(flee.points[0].pos.distanceTo(here)).toBeLessThan(1e-6);
    const end = flee.points[flee.points.length - 1].pos;
    expect(end.distanceTo(top)).toBeLessThan(1e-6);
  });

  it("접시 밑에 매달린 자리로 → 접시 밑면을 거꾸로 걸어 간다", () => {
    const under = spots.find((s) => s.mount === "under");
    if (!under) return;
    const route = router.between(spot(0), under);
    const last = route.points[route.points.length - 1];
    expect(last.up.y).toBeLessThan(-0.9);
  });
});

import { describe, expect, it } from "vitest";

import { Land } from "../world/land";
import { chainPath, railPath, streamPath } from "../world/paths";
import { from } from "../world/sphere";
import { ISLE_MAP } from "./isle";
import type { Spot } from "./layout";
import { V78_MAP } from "./v78";

// 세 마을 섬(v78 을 뭍만 남기고 자른 지도): 바다에 남은 것이 없고, 남은 것은 v78 의 그 자리 그대로다

const land = new Land(ISLE_MAP.land);
const isOnLand = (o: Spot) => land.has(from(o.dist, o.bear));
const WIDE = V78_MAP.layout,
  ISLE = ISLE_MAP.layout;

describe("cutToLand", () => {
  it("점 하나에 서는 것 → 뭍에 있는 것만, v78 의 자리 그대로(차례도 그대로)", () => {
    for (const kind of [
      "cannon",
      "rocket",
      "pad",
      "bumper",
      "thermal",
      "site",
      "tree",
      "lake",
    ] as const) {
      const kept = ISLE[kind] as Spot[],
        source = WIDE[kind] as Spot[];
      expect(kept.every(isOnLand), kind).toBe(true);
      expect(kept.length, kind).toBeGreaterThan(0);
      expect(kept.length, kind).toBeLessThan(source.length);
      const places = source.filter((o) => kept.includes(o));
      expect(places, kind).toEqual(kept);
    }
  });

  it("구름 구멍은 둘씩 짝이다 → 짝 없는 구멍이 남지 않는다(짝이 없으면 들어가도 나올 곳이 없다)", () => {
    expect(ISLE.hole.length).toBeGreaterThan(0);
    expect(ISLE.hole.length % 2).toBe(0);
    expect(ISLE.hole.every(isOnLand)).toBe(true);
  });

  it("두 끝이 모두 남은 구멍 짝 → v78 의 그 짝 그대로 서로를 잇는다", () => {
    let whole = 0;
    for (let i = 0; i + 1 < WIDE.hole.length; i += 2) {
      const first = ISLE.hole.indexOf(WIDE.hole[i]),
        second = ISLE.hole.indexOf(WIDE.hole[i + 1]);
      if (first < 0 || second < 0) continue;
      whole++;
      // 짝은 자리표에서 짝수 번째와 그다음이다
      expect([first % 2, second]).toEqual([0, first + 1]);
    }
    expect(whole).toBeGreaterThan(0);
  });

  it("길은 마디가 하나라도 바다면 → 통째로 뺀다", () => {
    for (const rail of ISLE.rail) {
      const nodes = railPath(rail).points;
      expect(nodes.every((pt) => land.has(pt.v))).toBe(true);
    }
    expect(ISLE.rail.length).toBeLessThan(WIDE.rail.length);
  });

  it("바람길 끝에 잇는 고리 줄·회오리 → 남은 바람길의 새 번호를 가리킨다(같은 바람길)", () => {
    const wideStreams = WIDE.stream.map((st) => streamPath(st)),
      isleStreams = ISLE.stream.map((st) => streamPath(st));
    const tied = ISLE.chain.filter((c) => c.afterStream != null);
    expect(tied.length).toBeGreaterThan(0);
    for (const chain of tied) {
      const source = WIDE.chain.find(
        (c) =>
          c.n === chain.n &&
          c.gap === chain.gap &&
          c.curve === chain.curve &&
          c.afterStream != null &&
          WIDE.stream[c.afterStream] === ISLE.stream[chain.afterStream!],
      );
      expect(source).toBeDefined();
      const before = chainPath(source!, wideStreams).points[0].v,
        after = chainPath(chain, isleStreams).points[0].v;
      expect(after.distanceTo(before)).toBeLessThan(1e-9);
    }
    for (const whirl of ISLE.whirl) {
      if (whirl.afterStream == null) continue;
      expect(ISLE.stream[whirl.afterStream]).toBeDefined();
    }
  });

  it("코드가 기대는 약속은 그대로: 장소 넷, 첫 언덕은 등대 산, 마을 여섯의 차례", () => {
    expect(ISLE.place).toEqual(WIDE.place);
    expect(ISLE.hill[0]).toBe(WIDE.hill[0]);
    expect(ISLE.hub).toEqual(WIDE.hub);
  });

  it("바다에 잠긴 마을 → 아무도 살지 않는 바다 지역, 뭍의 마을은 그대로", () => {
    const names = ISLE_MAP.regions.map((r) => r.name);
    expect(names).toEqual(["과자 언덕", "바다", "바다", "꽃밭", "구름 마을", "바다"]);
    const sea = ISLE_MAP.regions[1];
    expect([sea.herds, sea.residents, sea.flocks, sea.jellies, sea.skyBalloons]).toEqual([
      [],
      [],
      0,
      0,
      undefined,
    ]);
    expect(ISLE_MAP.regions[3]).toBe(V78_MAP.regions[3]);
  });

  it("제트 기류 → 뭍 위를 지나는 앞부분만(바다 한가운데에 내려놓지 않는다)", () => {
    const jets = [...ISLE.jet, ...ISLE_MAP.skyJets];
    expect(jets.length).toBeGreaterThan(0);
    expect(jets.length).toBeLessThan(WIDE.jet.length + V78_MAP.skyJets.length);
  });

  it("전설의 손님 자리 → 뭍에 있는 것만", () => {
    const spots = Object.values(ISLE_MAP.creatures.legends).flat();
    expect(spots.map(([hub]) => hub).sort()).toEqual([0, 3, 4]);
  });
});

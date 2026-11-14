import type { Layout } from "./layout";
import type { GameMap } from "./map";
import layoutJson from "./v64.layout.json";

// 시제품 v64 의 지도. 자리표(놀이기구·랜드마크·나무·호수·언덕·마을 자리)는 v64.layout.json, 그 밖의 수와 범위는 여기.
// 자리표는 시제품의 자리 계산 도구로 뽑은 값 그대로다. 구역 — 0–60 물가 · 60–120 바람 · 120–180 튕김 · 180–240 미끄럼 · 240–300 하늘 · 300–360 꽃밭

/** 시제품 v64 지도 */
export const V64_MAP: GameMap = {
  name: "v64",
  seed: 7,
  terrain: { flowers: 5200, mounds: 700, clouds: 260 },
  zones: [
    { name: "물가", from: 0, to: 60 },
    { name: "바람", from: 60, to: 120 },
    { name: "튕김", from: 120, to: 180 },
    { name: "미끄럼", from: 180, to: 240 },
    { name: "하늘", from: 240, to: 300 },
    { name: "꽃밭", from: 300, to: 360 },
  ],
  layout: layoutJson as Layout,
  skyJets: [
    { dist: 40, bear: 140, head: 85, n: 60, gap: 10, wig: 5 },
    { dist: 150, bear: 20, head: 95, n: 60, gap: 10, wig: -4 },
    { dist: 110, bear: 250, head: 90, n: 60, gap: 10, wig: 6 },
  ],
  placeSpots: [
    [0, 11, 40],
    [0, 14, 200],
    [1, 10, 80],
    [1, 13, 250],
    [2, 11, 20],
    [3, 16, 140],
  ],
  bigFlowers: { perHub: 60, tries: 150, dist: [22, 222], clear: 5 },
  bubbles: {
    perHub: 10,
    tries: 30,
    dist: [24, 220],
    clear: 2,
    perCluster: 7,
    spread: [1, 12],
    max: 420,
  },
  babyLimes: { perHub: 2, tries: 40, dist: [34, 204], clear: 4 },
  sculptures: {
    anchorHeight: [120, 140],
    gateHeight: [60, 90],
    avenue: 3,
    groves: { between: [0.36, 0.64], scattered: 14, top: [110, 155] },
    crown: { perHub: 10, alt: [70, 150], size: [22, 44] },
    fillTries: 560,
    lone: { count: 22, tries: 600, height: [70, 130] },
  },
  creatures: {
    firstHerdAhead: 13,
    herds: { perHub: 9, tries: 60, dist: [8, 113], clear: 6 },
    roaming: { herds: 27, flocks: 10, jellies: 12 },
    townFlocks: { perHub: 3, dist: [12, 72] },
    perLake: 2,
    jellies: {
      at: [
        [185, 12],
        [185, 100],
        [185, 192],
        [185, 281],
        [560, 45],
      ],
      perHub: 7,
      dist: [18, 113],
    },
    legends: {
      c_wcrown: [
        [0, 380, 130],
        [2, 340, 300],
        [4, 360, 20],
      ],
      c_deer: [
        [1, 330, 40],
        [3, 350, 200],
        [5, 300, 120],
      ],
    },
  },
  brand: {
    objects: [],
    lawnRings: [110, 140, 170, 200, 230, 260, 290, 320],
    balloons: {
      town: { dist: 34, alt: 13 },
      between: { count: 6, dist: [250, 290], alt: 17 },
      highAlt: 138,
    },
  },
};

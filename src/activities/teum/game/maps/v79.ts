import type { Layout, LayoutSite } from "./layout";
import { V79_ZONES } from "../zones";
import { regionOfZone } from "../zones/zone";
import type { GameMap } from "./map";
import layoutJson from "./v79.layout.json";

// 지도 v2(기획 MAP-02) 위에 티파티 정원(MAP-03 "거인의 다과상" — 둘이 다르면 MAP-03). 지금은 정원 하나만 꾸미고 다섯 지역은 비운다.
// 자리표(world-v3.layout.json — 기획의 plan2.py·garden.py 가 계산)는 v79.layout.json, 그 밖의 수·지역은 여기.
// 정원의 꾸밈 837(decor)은 자리표가 놓고, 지역이 흩뿌리는 꾸밈·생물·브랜드는 끈다(bare).
// v78 과 달리: 마을 0 티파티 정원 ↔ 1 과자 언덕 차례가 바뀌고, 놀이기구는 방향 띠가 아니라 자리표가 지역마다 무리로 놓고,
// 행성 전체에 같은 규칙으로 흩던 것(큰 꽃·비눗방울·꼬마 라임·조형물 숲·왕관 띠·외딴 조형물)은 끄거나 한 지역에만 둔다.
// 숨바꼭질 판은 띄우지 않는다(정원 숨바꼭질은 다음 단계) — 자유롭게 날아다니며 지역을 본다

/** 자리표 v3 의 쉼터({k, dist, bear, r, h}) → 이름·종류·말 — 회전목마·관람차·수레는 랜드마크, 나머지는 쉬는 곳 */
const GARDEN_SITES: Readonly<Record<string, { name: string; kind: string; msg: string }>> = {
  carousel: { name: "회전목마", kind: "land", msg: "회전목마 — 천천히 돕니다" },
  ferris: { name: "마카롱 관람차", kind: "land", msg: "마카롱 관람차 — 멀리서도 보이는 큰 바퀴" },
  candycart: { name: "솜사탕 수레", kind: "land", msg: "솜사탕 수레" },
  sofa: { name: "풍선 소파", kind: "rest", msg: "풍선 소파 — 쉬어 가는 곳" },
  picnic: { name: "피크닉 돗자리", kind: "rest", msg: "피크닉 돗자리 — 쉬어 가는 곳" },
  parasol: { name: "파라솔", kind: "rest", msg: "파라솔 — 쉬어 가는 곳" },
  gumdrops: { name: "젤리 방석", kind: "rest", msg: "젤리 방석 — 쉬어 가는 곳" },
};

/** 자리표 v3 의 쉼터 한 줄 */
interface GardenSite {
  k: string;
  dist: number;
  bear: number;
  r: number;
  h: number;
}

/** 지도 v2 */
export const V79_MAP: GameMap = {
  name: "v79",
  seed: 79,
  // 꽃은 꽃밭에만, 뭉게구름은 구름 마을 하늘에만, 둔덕은 없다(지형은 자리표의 언덕·바다·구름섬이 정한다)
  terrain: {
    flowers: 1400,
    mounds: 0,
    clouds: 90,
    flowersIn: { hub: 3, reach: 360 },
    cloudsIn: { hub: 4, reach: 380 },
    level: true,
  },
  zones: [],
  layout: gardenLayout(),
  // 지역은 존 설정(zones — 간식 존 + 아직 빈 다섯 존)에서 만든다
  zoneConfigs: V79_ZONES,
  regions: V79_ZONES.map(regionOfZone),
  // 지역 사이 땅은 아주 옅은 라벤더·흰색(맵에 초록 없음)
  regionEdge: { from: 0.78, width: 0.12, ground: [0xe9e3ff, 0xfbfaff] },
  // 제트 기류는 자리표(jet — 구름 마을 셋)에만
  skyJets: [],
  placeSpots: [
    [0, 11, 40],
    [0, 14, 200],
    [1, 10, 80],
    [1, 13, 250],
    [2, 11, 20],
    [3, 16, 140],
  ],
  // 큰 꽃은 꽃밭에만, 비눗방울은 물가에만, 꼬마 라임은 없다
  bigFlowers: { perHub: 40, tries: 150, dist: [22, 222], clear: 5, hubs: [3] },
  bubbles: {
    perHub: 14,
    tries: 40,
    dist: [24, 220],
    clear: 2,
    perCluster: 7,
    spread: [1, 12],
    max: 300,
    hubs: [5],
  },
  babyLimes: { perHub: 0, tries: 0, dist: [34, 204], clear: 4 },
  // 조형물은 그 지역 것만(지역 밖·경계에서는 놓지 않는다). 마을 기준탑·높이 사다리·문·숲·왕관 띠·외딴 조형물은 끈다 —
  // 랜드마크·문은 자리표가 정한다
  sculptures: {
    anchorHeight: [120, 140],
    anchorTries: 0,
    gateHeight: [60, 90],
    avenue: 0,
    groves: { between: [], scattered: 0, top: [110, 155] },
    crown: { perHub: 0, alt: [70, 150], size: [22, 44] },
    fillTries: 420,
    lone: { count: 0, tries: 0, height: [70, 130] },
    between: { skip: 1, treeSkip: 1 },
    strict: true,
    ladder: false,
    gates: false,
  },
  creatures: {
    firstHerdAhead: 13,
    firstHerd: 2,
    herds: { tries: 60, dist: [8, 113], clear: 6 },
    festival: 2,
    roaming: { herds: 16, flocks: 6, jellies: 8 },
    townFlocks: { dist: [12, 72] },
    perLake: 2,
    seaSwimmers: 12,
    jellies: { at: [], dist: [18, 113] },
    // 전설: 왕관은 장난감 궁전(2)에만 셋, 사슴은 꽃밭(3)에만 셋
    legends: {
      c_wcrown: [
        [2, 330, 60],
        [2, 300, 180],
        [2, 360, 300],
      ],
      c_deer: [
        [3, 330, 40],
        [3, 300, 160],
        [3, 350, 280],
      ],
    },
  },
  brand: {
    objects: [],
    lawnRings: [110, 140, 170, 200, 230, 260, 290, 320],
    balloons: {
      town: { dist: 34, alt: 13 },
      between: { count: 0, dist: [250, 290], alt: 17 },
      highAlt: 138,
    },
  },
  startHub: 0,
  hideSeek: false,
  fog: { near: 60, far: 720 },
  // 꾸밈은 자리표(decor)만 — 지역이 흩뿌리는 꾸밈·생물·브랜드는 없다
  bare: true,
  // 내가 어디 있는지(기획 MINIMAP-01 4장 가안)
  minimap: { size: 76, regionName: { seconds: 1.2, cooldown: 10 }, bigMap: { width: 0.85 } },
  // 티파티 정원(MAP-03): 광장의 분수 탑·뽑기 기계는 꾸밈이 그리고(소원 나무 없음), 큰 공은 분홍, 꽃 줄기·잎·가운데는 흰색
  garden: { region: 0, ball: 0xff6fa5, flowerParts: 0xffffff, toy: 0xff9ec8, hole: 0xffffff },
};

/* ─── 내부 ─────────────────────────── */

// 자리표 v3 를 엔진의 꼴로: 쉼터는 높이 h 그대로(키우지 않는다 — sc 1). 기획용 갈래(정원 이름 garden·놀이터 playground)는 뺀다
function gardenLayout(): Layout {
  const raw = layoutJson as unknown as Omit<Layout, "site"> & {
    site: GardenSite[];
    garden?: unknown;
  };
  const site = raw.site.map((st): LayoutSite => {
    const known = GARDEN_SITES[st.k] ?? { name: st.k, kind: "rest", msg: st.k };
    return { ...known, k: st.k, dist: st.dist, bear: st.bear, r: st.r, size: st.h, by: "h", sc: 1 };
  });
  const layout = { ...raw, site };
  delete layout.garden;
  delete layout.playground;
  return layout;
}

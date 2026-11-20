import type { Layout } from "./layout";
import type { GameMap, MapRegion } from "./map";

// 맵만 보기(오너 2026-11-20 — "기구·랜드마크 말고 나머지는 다 빼 봐, 지금 맵 그 자체를 보고 싶다"):
// 놀이기구·랜드마크(장소·큰 구조물·임시 랜드마크)·지형·길·문만 남긴다. 생물(말 거는 것 포함)·별·주워 드는 풍선과 나비 날개
// (오너 — "풍선 나비는 아직도 있는데?")·나무·조형물·꽃·쉬는 곳·로고 풍선·잔디 로고는 놓지 않는다. 값만 비우므로 지도 bare 를 끄면 그대로 돌아온다

/** 지도 bare 가 켜진 지도에서 꾸밈을 뺀 지도 */
export function bareOf(map: GameMap): GameMap {
  const L = map.layout;
  const site = L.site.filter((st) => st.kind !== "rest");
  const layout: Layout = { ...L, star: [], balloon: [], wing: [], tree: [], site };
  const regions = map.regions.map(bareRegion);
  const { creatures, brand } = map;
  return {
    ...map,
    layout,
    regions,
    terrain: { ...map.terrain, flowers: 0, clouds: 0 },
    bigFlowers: { ...map.bigFlowers, perHub: 0 },
    bubbles: { ...map.bubbles, perHub: 0 },
    babyLimes: { ...map.babyLimes, perHub: 0 },
    creatures: {
      ...creatures,
      firstHerd: 0,
      roaming: { herds: 0, flocks: 0, jellies: 0 },
      perLake: 0,
      seaSwimmers: 0,
      jellies: { ...creatures.jellies, at: [] },
      legends: {},
    },
    // 잔디 로고 자리는 그대로 맡고(자리 찾기가 늘 한 곳을 고른다) 그리지만 않는다 — brand/signature
    brand: { ...brand, objects: [] },
  };
}

/* ─── 내부 ─────────────────────────── */

// 지역에서 조형물·나무·열기구·생물을 비운다(땅·하늘 색은 그대로)
function bareRegion(r: MapRegion): MapRegion {
  return {
    ...r,
    big: [],
    small: [],
    tree: null,
    skyBalloons: undefined,
    residents: [],
    herds: [],
    flocks: 0,
    jellies: 0,
  };
}

import type { GameMap, MapRegion } from "./map";

// 꾸밈은 자리표만(오너 2026-11-20 "맵 그 자체를 보고 싶다" → MAP-03 티파티 정원): 자리표가 놓은 것(놀이기구·쉼터·장소·
// 랜드마크·꾸밈 decor·지형·길·문)은 모두 그리고, 지역이 흩뿌리는 꾸밈(조형물·나무·꽃·열기구·비눗방울·꼬마 라임)·생물·
// 브랜드 오브젝트, 자리표 밖의 놀이기구(고래·혜성 — rides/whale·comet 이 bare 를 본다)는 놓지 않는다. 값만 비우므로 지도 bare 를 끄면 그대로 돌아온다

/** 지도 bare 가 켜진 지도에서 지역이 흩뿌리는 꾸밈·생물·브랜드를 뺀 지도 */
export function bareOf(map: GameMap): GameMap {
  const regions = map.regions.map(bareRegion);
  const { creatures, brand } = map;
  return {
    ...map,
    regions,
    // 장소 곁 생물 자리(회색 공)도 없다
    placeSpots: [],
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

// 지역에서 조형물·나무·열기구·생물을 비운다(땅·하늘·길 색은 그대로)
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

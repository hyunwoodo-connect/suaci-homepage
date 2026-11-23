import { cutToLand } from "./landCut";
import type { GameMap, MapLand, WaterBalloonSpot } from "./map";
import { V78_MAP } from "./v78";

// 세 마을 섬: 기본 지도(v78)에서 과자 언덕·꽃밭·구름 마을 쪽 반구만 뭍으로 남기고 나머지는 바다로 둔 지도.
// 뭍의 놀이기구 자리는 v78 과 같다 — 다음 놀이기구가 가까이 이어지는 배치를 그대로 쓰려는 것이다

/** 뭍: 세 마을(출발점·방향 180 도·270 도 마을)의 한가운데에서 반구 */
const LAND: MapLand = { dist: 225.8, bear: 225, reach: 90 };

/**
 * 물풍선 열 개: 숨기지 않고 놀이기구가 데려다주는 자리에 둔다 — 놀이기구를 타면 그 궤적이 풍선을 지난다
 * (자리와 높이는 놀이기구를 하나씩 타 보고 잰 꼭대기). 마을마다 서넛, 마을 사이 길목에 둘
 */
const WATER_BALLOONS: readonly WaterBalloonSpot[] = [
  // ---- 과자 언덕 ----
  // 광장 곁 구름 방석이 튕겨 올리는 꼭대기(45m)
  { dist: 21.8, bear: 123.2, alt: 40 },
  // 상승 기류 기둥 속(72m 까지 떠오르는 길)
  { dist: 52.3, bear: 66.9, alt: 38 },
  // 대포가 쏘아 올린 꼭대기
  { dist: 80.2, bear: 141.6, alt: 39 },
  // 로켓이 쏘아 올리는 길 — 이 위에 suaci 높은 풍선(138m)이 있다. 로켓이 놓기 전(곧게 오르는 동안)의 높이라 어느 쪽에서 타도 지난다
  { dist: 44.6, bear: 261.8, alt: 115 },
  // ---- 꽃밭 ----
  // 열기구에 매달려 올라간 곳
  { dist: 326, bear: 170.6, alt: 19 },
  // 대포가 쏘아 올린 꼭대기
  { dist: 366.7, bear: 194.9, alt: 39 },
  // 과자 언덕에서 오는 길목의 회오리 한가운데(회오리는 가운데를 3m 쯤 돌며 오른다)
  { dist: 240.15, bear: 169.51, alt: 30 },
  // ---- 구름 마을 ----
  // 상승 기류 기둥 속 높은 곳
  { dist: 338.2, bear: 259.6, alt: 60 },
  // 로켓이 쏘아 올리는 길의 높은 곳(놓인 뒤 2m 넘게 흘러가기 전)
  { dist: 363.3, bear: 281, alt: 140 },
  // 과자 언덕에서 오는 길목의 대포 꼭대기
  { dist: 246.7, bear: 259.4, alt: 39 },
];

/** 세 마을 섬 */
export const ISLE_MAP: GameMap = {
  ...cutToLand(V78_MAP, LAND),
  name: "isle",
  waterBalloons: WATER_BALLOONS,
};

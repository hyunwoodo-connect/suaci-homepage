import { cutToLand } from "./landCut";
import type { GameMap, MapLand } from "./map";
import { V78_MAP } from "./v78";

// 세 마을 섬: 기본 지도(v78)에서 과자 언덕·꽃밭·구름 마을 쪽 반구만 뭍으로 남기고 나머지는 바다로 둔 지도.
// 뭍의 놀이기구 자리는 v78 과 같다 — 다음 놀이기구가 가까이 이어지는 배치를 그대로 쓰려는 것이다

/** 뭍: 세 마을(출발점·방향 180 도·270 도 마을)의 한가운데에서 반구 */
const LAND: MapLand = { dist: 225.8, bear: 225, reach: 90 };

/** 세 마을 섬 */
export const ISLE_MAP: GameMap = { ...cutToLand(V78_MAP, LAND), name: "isle" };

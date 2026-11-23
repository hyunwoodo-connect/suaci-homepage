import { ISLE_MAP } from "./isle";
import type { GameMap } from "./map";
import { V78_MAP } from "./v78";

// 지도 목록. 새 지도는 파일 하나(maps/<이름>.ts, 자리표가 크면 <이름>.layout.json 도) + 아래 한 줄.
// 운영은 늘 DEFAULT_MAP 이고, 개발에서는 ?map=<이름> 으로 고른다

/** 이름 → 지도 */
export const MAPS: Readonly<Record<string, GameMap>> = { v78: V78_MAP, isle: ISLE_MAP };

/** 운영이 늘 쓰는 지도: 세 마을 섬(물풍선 놀이). 넓은 지도 v78 은 개발에서 ?map=v78 */
export const DEFAULT_MAP: GameMap = ISLE_MAP;

/** 이름의 지도. 없으면 null */
export function mapNamed(name: string): GameMap | null {
  if (!Object.hasOwn(MAPS, name)) return null;
  return MAPS[name];
}

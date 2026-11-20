import type { GameMap } from "./map";
import { V78_MAP } from "./v78";

// 지도 목록. 새 지도는 파일 하나(maps/<이름>.ts, 자리표가 크면 <이름>.layout.json 도) + 아래 한 줄.
// 운영은 DEFAULT_MAP 이고, 개발에서는 ?map=<이름> 으로 고른다.
// 오너가 미리 보기에서 확인할 새 지도는 LAZY_MAPS 에 둔다 — 운영에서도 ?map=<이름> 이 읽히고, 그 주소로 열 때만 받는다(기본 묶음을 키우지 않게)

/** 이름 → 지도 */
export const MAPS: Readonly<Record<string, GameMap>> = { v78: V78_MAP };

/** 운영이 늘 쓰는 지도 */
export const DEFAULT_MAP: GameMap = V78_MAP;

/** 이름의 지도. 없으면 null */
export function mapNamed(name: string): GameMap | null {
  if (!Object.hasOwn(MAPS, name)) return null;
  return MAPS[name];
}

/** 고를 때만 받는 지도: 이름 → 불러오기(운영에서도 ?map= 으로 고른다 — 지도 v2 를 오너가 폰으로 본다) */
export const LAZY_MAPS: Readonly<Record<string, () => Promise<GameMap>>> = {
  v79: () => import("./v79").then((m) => m.V79_MAP),
};

/** 주소의 ?map= 이 고를 때만 받는 지도이면 그 이름, 아니면 null */
export function lazyMapName(search: string = location.search): string | null {
  const name = new URLSearchParams(search).get("map");
  if (name === null || !Object.hasOwn(LAZY_MAPS, name)) return null;
  return name;
}

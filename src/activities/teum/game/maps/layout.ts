// 자리표의 모양: 지도(GameMap)의 layout 이 이 모양이다(기본 지도는 v78.layout.json).
// 자리는 출발점에서 거리(dist, 넓이 S.wide 배)와 방향(bear, 도)

/** 출발점에서 거리와 방향 */
export interface Spot {
  dist: number;
  bear: number;
}

/** 놓이는 방향(head, 도 — 0 은 광장에서 멀어지는 쪽)이 있는 자리 */
export interface HeadedSpot extends Spot {
  head: number;
}

/** 랜드마크(land)와 쉬는 곳(rest) */
export interface LayoutSite extends Spot {
  k: string;
  name: string;
  kind: string;
  size: number;
  by: string;
  r: number;
  msg: string;
  lift?: number;
  sky?: number;
  /** 겹치지 않는 만큼 키운 배율 — 배치가 채운다 */
  sc?: number;
}

/** 키 큰 솜사탕 나무 */
interface LayoutTree extends Spot {
  t: string;
  H: number;
}

/** 반지름이 있는 자리(호수) */
export interface RoundSpot extends Spot {
  r: number;
}

/** 이름 붙은 장소(광장·분수·뽑기터·등대 — 이 차례로 넷) */
interface LayoutPlace extends RoundSpot {
  name: string;
}

/** 여러 마디로 이어지는 길(바람길·레일·제트 기류) */
export interface LayoutPath extends HeadedSpot {
  n: number;
  gap: number;
  wig: number;
}

/** 구름 다리 */
export interface LayoutArch extends HeadedSpot {
  n: number;
  gap: number;
  arch: number;
  curve: number;
}

/** 징검 구름 */
export interface LayoutHop extends HeadedSpot {
  n: number;
  gap: number;
}

/** 고리 줄 — 바람길 끝(afterStream)에서 이어지기도 한다 */
export interface LayoutChain {
  dist?: number;
  bear?: number;
  head?: number;
  n: number;
  gap: number;
  rise: number;
  curve: number;
  afterStream?: number;
}

/** 기둥 줄 */
export interface LayoutRow extends HeadedSpot {
  n: number;
}

/** 회오리 — 바람길 끝(afterStream)에 놓이기도 한다 */
export interface LayoutWhirl {
  dist?: number;
  bear?: number;
  afterStream?: number;
}

/** 오로라 길(라임빛 제트 기류) */
export interface LayoutJet extends LayoutPath {
  aurora?: number;
}

/** 큰 언덕(첫 줄은 등대 산) */
export interface LayoutHill extends Spot {
  s: number;
  H: number;
}

/** 자리표 전체 */
export interface Layout {
  place: LayoutPlace[];
  site: LayoutSite[];
  tree: LayoutTree[];
  lake: RoundSpot[];
  pipe: HeadedSpot[];
  funnel: Spot[];
  seed: Spot[];
  stream: LayoutPath[];
  rail: LayoutPath[];
  arch: LayoutArch[];
  hop: LayoutHop[];
  chain: LayoutChain[];
  row: LayoutRow[];
  bumper: Spot[];
  star: Spot[];
  whirl: LayoutWhirl[];
  chime: Spot[];
  thermal: Spot[];
  cannon: HeadedSpot[];
  sling: HeadedSpot[];
  swing: HeadedSpot[];
  rocket: Spot[];
  balloon: Spot[];
  wing: Spot[];
  pad: Spot[];
  ball: Spot[];
  hole: Spot[];
  jet: LayoutJet[];
  hill: LayoutHill[];
  hub: Spot[];
}

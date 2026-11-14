import layoutJson from "./layout.json";

// 배치 자리표: 구역을 나눠 겹치지 않게 놓은 자리(시제품의 자리 계산 도구로 뽑은 값 그대로, layout.json).
// 자리는 출발점에서 거리(dist, 넓이 S.wide 배)와 방향(bear, 도). 구역 — 0–60 물가 · 60–120 바람 · 120–180 튕김 · 180–240 미끄럼 · 240–300 하늘 · 300–360 꽃밭

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
export interface LayoutTree extends Spot {
  t: string;
  H: number;
}

/** 반지름이 있는 자리(호수·장소) */
export interface RoundSpot extends Spot {
  r: number;
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
  place: RoundSpot[];
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

/** 게임 한 판이 쓸 자리표. 배치가 자리표에 값을 덧붙이므로(크기 배율·마디) 판마다 새로 복사한다 */
export function cloneLayout(): Layout {
  return structuredClone(layoutJson) as Layout;
}

// 자리표의 모양: 지도(GameMap)의 layout 이 이 모양이다(v78 은 v78.layout.json).
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
  /** 겹치지 않는 만큼 키운 배율 — 배치가 채운다(지도가 정해 오면 그대로 둔다) */
  sc?: number;
}

/** 키 큰 솜사탕 나무 */
export interface LayoutTree extends Spot {
  t: string;
  H: number;
}

/** 반지름이 있는 자리(호수) */
export interface RoundSpot extends Spot {
  r: number;
}

/** 호수(v79: 색과 어느 지역의 물인지가 붙는다) */
export interface LayoutLake extends RoundSpot {
  /** 물빛 — 없으면 물, chocolate 이면 초콜릿 시내 */
  tint?: "chocolate";
  /** 이 물이 있는 지역(헤엄치는 생물을 그 지역 종으로) */
  region?: number;
}

/** 이름 붙은 장소(광장·분수·뽑기터·등대 — 이 차례로 넷) */
export interface LayoutPlace extends RoundSpot {
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

/** 지역의 랜드마크(v79): 이름·높이(m)·바닥 반지름(m)·비워 두는 게임 마당 반지름(m)·모델이 오기 전 임시 모델 키 */
export interface LayoutLandmark extends Spot {
  region: number;
  name: string;
  height: number;
  footR: number;
  gameR: number;
  placeholder: string;
  /** 꾸민 지역(MAP-03): 랜드마크 모델(높이 height 로 세운다) · 층마다 윗면 높이·반지름(m — 숨바꼭질 발판) */
  model?: string;
  tiers?: readonly LayoutTier[];
}

/** 랜드마크 한 층: 윗면 높이 h(m)·반지름 r(m) */
export interface LayoutTier {
  h: number;
  r: number;
}

/**
 * 꾸밈 하나(MAP-03): 모델 키를 높이 h(m)로 세우고 rot(도)만큼 돌리고 땅에서 lift(m) 띄운다. zone 은 기획의 구역 이름.
 * plate 는 코드로 그리는 접시(반지름 r)
 */
export interface LayoutDecor extends Spot {
  model: string;
  h: number;
  rot: number;
  zone: string;
  lift?: number;
  r?: number;
}

/** 숨바꼭질 리본 물건 자리(MAP-03): 층 tier(0 땅, 1~3 케이크 층 — lift 가 층 높이) */
export interface LayoutHideSpot extends Spot {
  model: string;
  h: number;
  tier: number;
  lift?: number;
}

/** 큰 길(v79): 이웃한 랜드마크 둘(마을 차례)을 잇는 점들([dist, bear], 20m 간격) */
export interface LayoutRoad {
  between: readonly number[];
  points: readonly (readonly number[])[];
}

/** 경계의 문(v79): 큰 길이 지역 경계를 넘는 자리 · 길이 나아가는 쪽(head) · 잇는 두 지역 */
export interface LayoutGate extends HeadedSpot {
  between: readonly number[];
}

/** 지역이 붙은 둥근 자리(v79 게임 마당·바다) */
export interface RegionRound extends RoundSpot {
  region: number;
}

/** 떠 있는 구름섬(v79): 높이(m)·반지름(m) — 위에 내려앉을 수 있다 */
export interface LayoutCloudIsland extends Spot {
  alt: number;
  r: number;
}

/** 놀이터 가운데(v79 기획용 — 기구는 이미 그 둘레에 무리로 놓였다. 엔진은 쓰지 않는다) */
export interface LayoutPlayground extends Spot {
  region: number;
  n: number;
  r: number;
}

/** 이동 구멍(v79 는 어느 지역 것인지가 붙는다) */
export interface LayoutHole extends Spot {
  region?: number;
}

/** 자리표 전체 */
export interface Layout {
  place: LayoutPlace[];
  site: LayoutSite[];
  tree: LayoutTree[];
  lake: LayoutLake[];
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
  hole: LayoutHole[];
  jet: LayoutJet[];
  hill: LayoutHill[];
  hub: Spot[];
  // ---- v79 에서 붙은 갈래(없으면 빈 것) ----
  landmark?: LayoutLandmark[];
  gameZone?: RegionRound[];
  road?: LayoutRoad[];
  gate?: LayoutGate[];
  sea?: RegionRound[];
  cloudIsland?: LayoutCloudIsland[];
  playground?: LayoutPlayground[];
  /** 꾸민 지역의 꾸밈(MAP-03 — 모델마다 한 묶음으로 그린다) · 숨바꼭질 리본 물건 자리 */
  decor?: LayoutDecor[];
  hideSpot?: LayoutHideSpot[];
}

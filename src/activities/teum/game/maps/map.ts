import type { Layout, LayoutJet } from "./layout";

// 지도 하나: 무엇을 어디에 몇 개 놓는지(값)만 담는다. 놓는 규칙(겹침 피하기·고르는 셈·차례)은 각 모듈의 코드에 있다.
// 지도를 바꾸는 것은 이 모양의 값을 고치는 일이다(maps/v64.ts · v64.layout.json). 거리 단위는 줄마다 적었다 —
// '자리표 거리'는 넓이(S.wide) 배를 하는 거리, 'm' 는 행성 위 실제 거리

/** [가장 작게, 가장 크게] — 그 사이에서 자리마다 고정된 난수로 고른다 */
export type Span = readonly [number, number];

/** 마을마다 흩어 놓기: 마을 중심에서 dist 사이(멀수록 드물지 않게 넓이에 고르게), 둘레가 빈 자리에만 */
export interface HubScatter {
  /** 마을마다 놓는 수 */
  perHub: number;
  /** 마을마다 자리를 찾아보는 횟수(빈자리가 모자라면 perHub 보다 적게 놓인다) */
  tries: number;
  /** 마을 중심에서 거리(자리표 거리) */
  dist: Span;
  /** 그 둘레가 비어 있어야 하는 반지름(m) */
  clear: number;
}

/** 구역: 출발점에서 본 방향(도) 범위와 이름 */
export interface MapZone {
  name: string;
  from: number;
  to: number;
}

/** 장소 곁 생물 자리 공: [장소 차례(layout.place), 거리 m, 방향] */
export type PlaceSpot = readonly [number, number, number];

/** 전설의 손님 자리: [마을 차례(layout.hub), 거리 m, 방향] */
export type LegendSpot = readonly [number, number, number];

/** suaci 프로모션 오브젝트(로고·제품) 하나의 자리 */
export interface BrandPlacement {
  /** manifest 에셋 키(분류 brand) */
  key: string;
  /** 출발점에서 거리(자리표 거리)와 방향(도) */
  dist: number;
  bear: number;
  /** 크기와 그 크기를 재는 쪽(h 키, w 너비) */
  size: number;
  by: "h" | "w";
  /** 땅에서 띄우는 높이 */
  lift?: number;
}

/**
 * 조형물(sculptures): 놓는 여덟 단계(번호는 sculptures.ts 의 단계) 가운데 지도가 정하는 수와 크기.
 * 5) 높이 사다리는 마을마다 같은 모양(낮은 것 → 큰 것 → 나무 → 열기구)이라 코드에 있다
 */
export interface SculptureMap {
  /** 1) 마을 기준탑 높이 */
  anchorHeight: Span;
  /** 2) 다른 마을로 가는 길목의 문 높이 */
  gateHeight: Span;
  /** 3) 대포 길 양옆 가로수: 대포마다 양옆에 이만큼씩 */
  avenue: number;
  /** 4) 숲 덩어리: 마을 사이 길 위 어디쯤(0~1)에 · 그 밖에 행성 곳곳의 숲 수 · 가운데 나무 높이 */
  groves: { between: readonly number[]; scattered: number; top: Span };
  /** 6) 열기구 왕관: 마을마다 수(10 까지) · 높이 · 크기 */
  crown: { perHub: number; alt: Span; size: Span };
  /** 7) 사이 채움: 행성 위 자리를 찾아보는 횟수(큰 것 하나에 작은 것 한두 개) */
  fillTries: number;
  /** 8) 외딴 거대 조형물: 수 · 찾아보는 횟수 · 높이 */
  lone: { count: number; tries: number; height: Span };
}

/** 생물(creatures): 어디에 몇 무리 — 종은 생물 설정표(assets/settings CREATURES)의 차례대로 돌려 쓴다 */
export interface CreatureMap {
  /** 출발하자마자 눈앞(이만큼 앞, m)에 첫 무리 */
  firstHerdAhead: number;
  /** 마을마다 땅 위 무리 */
  herds: HubScatter;
  /** 떠도는 무리(내가 멀어지면 내 앞쪽 먼 곳으로 옮겨 간다): 땅 위·하늘·해파리 */
  roaming: { herds: number; flocks: number; jellies: number };
  /** 마을 하늘을 셋씩 도는 무리: 마을마다 수 · 마을 중심에서 거리(자리표 거리) */
  townFlocks: { perHub: number; dist: Span };
  /** 호수마다 헤엄치는 수 */
  perLake: number;
  /** 해파리: 정해 둔 자리([자리표 거리, 방향]) · 마을마다 수 · 마을 중심에서 거리(자리표 거리) */
  jellies: { at: readonly (readonly [number, number])[]; perHub: number; dist: Span };
  /** 전설의 손님: 종 키 → 자리. 온 행성에 이 자리뿐이고 옮기지 않는다(종은 설정표에 legend 가 있어야 한다) */
  legends: Readonly<Record<string, readonly LegendSpot[]>>;
}

/** 브랜드(brand): 프로모션 오브젝트·잔디 로고·로고 풍선 */
export interface BrandMap {
  /** 놓을 프로모션 오브젝트 — 오너가 정하면 채운다 */
  objects: readonly BrandPlacement[];
  /** 잔디 로고 자리를 찾아보는 출발점에서의 거리(m) — 가장 빈 풀밭을 고른다 */
  lawnRings: readonly number[];
  /** 로고 풍선: 마을마다 하나(중심에서 자리표 거리·높이) · 마을 사이(수·거리 m·높이) · 출발 마을에서 가장 가까운 로켓 위 높은 풍선의 높이 */
  balloons: {
    town: { dist: number; alt: number };
    between: { count: number; dist: Span; alt: number };
    highAlt: number;
  };
}

/** 지도 하나 */
export interface GameMap {
  /** 이름(개발에서 ?map= 으로 고른다) */
  name: string;
  /** 지형 씨앗 — 꽃 자리·둔덕·뭉게구름·큰 언덕 비탈의 솜을 이 씨앗으로 뽑는다(같은 씨앗이면 같은 지형) */
  seed: number;
  /** 지형: 꽃 자리·둔덕·뭉게구름 수 */
  terrain: { flowers: number; mounds: number; clouds: number };
  /** 구역(출발점에서 본 방향) — 자리를 고를 때의 기준. 게임 규칙은 보지 않고 지도 점검이 센다 */
  zones: readonly MapZone[];
  /** 자리표: 장소·랜드마크·키 큰 나무·호수·놀이기구·큰 언덕(첫째는 등대 산)·마을 중심 */
  layout: Layout;
  /** 높은 하늘의 제트 기류(자리표의 오로라 길 jet 앞에 놓인다) */
  skyJets: readonly LayoutJet[];
  /** 장소 곁 생물 자리 공 */
  placeSpots: readonly PlaceSpot[];
  /** 큰 풍선 꽃 */
  bigFlowers: HubScatter;
  /** 비눗방울 무리: 무리마다 방울 수 · 무리 가운데에서 퍼지는 거리(m) · 온 행성 최대 방울 수 */
  bubbles: HubScatter & { perCluster: number; spread: Span; max: number };
  /** 꼬마 라임 */
  babyLimes: HubScatter;
  sculptures: SculptureMap;
  creatures: CreatureMap;
  brand: BrandMap;
}

/** span 안에서 roll(0..1) 만큼의 값 */
export function within(span: Span, roll: number): number {
  const [lo, hi] = span;
  return lo + (hi - lo) * roll;
}

/** 게임 한 판이 쓸 자리표. 배치가 자리표에 값을 덧붙이므로(크기 배율·마디) 판마다 새로 복사한다 */
export function cloneLayout(map: GameMap): Layout {
  return structuredClone(map.layout);
}

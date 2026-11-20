import { LOOK } from "../look";
import type { LayoutTier } from "../maps/layout";
import type { MapRegion } from "../maps/map";
import type { Motion } from "../player/motion";
import { DEFAULT_MOTION } from "../player/motion";

// 존 설정(오너 2026-11-20 — "설정 하나 + 자리표만 넣으면 존이 하나 생기게"): 존마다 파일 하나(zones/<id>.ts)에 이 꼴로 쓴다.
// 존을 나누는 세 가지(지역-컨셉-6): ① 키컬러(바닥·하늘·안개·빛) ② 오브젝트(쓰는 모델·색 바꾸기·흩뿌림) ③ 인터랙션(몸놀림).
// 비워 둔 칸은 기본값 — 설정이 빈 존은 기본 땅·빛 기둥만으로 뜬다. 지도(v79)는 존 목록에서 지역(MapRegion)을 만든다

/** 존의 키컬러: 바닥 두 색·체크 칸(m)·큰 길·하늘·안개·빛(해의 색·세기) */
export interface ZoneColors {
  ground?: readonly [number, number];
  checker?: number;
  road?: number;
  sky?: number;
  fog?: number;
  light?: { color?: number; intensity?: number };
}

/** 모델 하나를 이 존에서 어떻게 쓰나: 색 바꾼 변형 모델(에셋 빌드의 존별 색 바꾸기 — 예 flower_pink@candy) · 통째 색 곱하기 */
export interface ModelLook {
  variant?: string;
  tint?: number;
}

/** 지역이 흩뿌리는 꾸밈(있으면): 조형물 큰 것·작은 것·나무 — 자리표 decor 로 채우는 존은 비운다 */
export interface ZoneScatter {
  big?: readonly string[];
  small?: readonly string[];
  tree?: string | null;
}

/** 존의 소리(에셋 키 — 파일이 없으면 조용히): 배경 소리 · 랜드마크에 다가갈 때 한 번 */
export interface ZoneSound {
  ambient?: string;
  landmark?: string;
}

/** 랜드마크 꼭대기 장식(landmark/top 의 이름) */
export type TopDecorName = "candles";

/**
 * 존의 랜드마크: 모델·높이(m)·바닥 반지름(m)·층(발판)·꼭대기 장식 · 연출 색(빛 기둥·반짝이). 자리는 자리표 landmark.
 * 비우면 자리표 값, 그것도 없으면 빛 기둥만
 */
export interface ZoneLandmark {
  model?: string;
  height?: number;
  footR?: number;
  tiers?: readonly LayoutTier[];
  top?: TopDecorName;
  beacon?: number;
  sparkles?: readonly number[];
}

/** 존 설정 하나 */
export interface ZoneConfig {
  /** 짧은 이름(파일 이름·주소 값 ?zone= ·변형 모델 꼬리표) */
  id: string;
  /** 화면에 보이는 이름(지역 이름 1.2초·큰 지도) */
  name: string;
  /** 마을 번호(자리표 hub 차례) */
  hub: number;
  colors?: ZoneColors;
  objects?: { models?: Readonly<Record<string, ModelLook>>; scatter?: ZoneScatter };
  motion?: Partial<Motion>;
  sound?: ZoneSound;
  landmark?: ZoneLandmark;
  /** 이 존 랜드마크에서 여는 미니게임(minigame/registry 의 id) — 없으면 비운다 */
  minigame?: string;
}

/** 설정이 빈 존의 키컬러: 옅은 라벤더·흰 바닥, 기본 하늘 */
export const DEFAULT_ZONE_COLORS = {
  ground: [0xe9e3ff, 0xfbfaff] as const,
  sky: 0xc9cbe8,
} as const;

/** 존 설정 → 엔진의 지역(땅·하늘·길 색, 흩뿌림). 생물은 아직 없다 */
export function regionOfZone(zone: ZoneConfig): MapRegion {
  const c = zone.colors ?? {};
  const scatter = zone.objects?.scatter ?? {};
  return {
    name: zone.name,
    ground: c.ground ?? DEFAULT_ZONE_COLORS.ground,
    checker: c.checker,
    road: c.road,
    hue: 0,
    sky: c.sky ?? DEFAULT_ZONE_COLORS.sky,
    big: scatter.big ?? [],
    small: scatter.small ?? [],
    tree: scatter.tree ?? null,
    skip: 0,
    treeSkip: 0,
    balloonSkip: 1,
    treeHeight: 1,
    residents: [],
    herds: [],
    flocks: 0,
    jellies: 0,
  };
}

/** 존의 몸놀림(정하지 않은 값은 기본값) */
export function motionOf(zone: ZoneConfig | undefined): Motion {
  return { ...DEFAULT_MOTION, ...zone?.motion };
}

/** 존의 안개 색(정하지 않으면 하늘색) */
export function fogOf(zone: ZoneConfig): number {
  const c = zone.colors;
  return c?.fog ?? c?.sky ?? DEFAULT_ZONE_COLORS.sky;
}

/** 이 존에서 그릴 모델 키: 변형 모델이 있으면 그것(has 가 manifest 를 본다) */
export function modelKeyIn(zone: ZoneConfig | undefined, key: string, has: (k: string) => boolean) {
  const variant = zone?.objects?.models?.[key]?.variant;
  return variant && has(variant) ? variant : key;
}

/** 해의 기본 색 */
export const DEFAULT_SUN = 0xffffff;
/** 해의 기본 세기 */
export const DEFAULT_SUN_INTENSITY: number = LOOK.sunI;

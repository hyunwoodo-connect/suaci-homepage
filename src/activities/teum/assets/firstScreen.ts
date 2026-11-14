import { AVATAR_BODY, AVATAR_COMPANION, DEFAULT_WEAR } from "../game/avatar/parts";

import type { Manifest } from "./manifest";

/** 생물이 그려지는 거리(행성 위 각도의 cos) — 생물 프레임이 `v · p > 0.9` 일 때만 그린다 */
export const CREATURE_VIEW_COS = 0.9;

/** 첫 화면에 통째로 받는 분류: 하늘, 나무, 꽃 */
const FIRST_CATEGORIES = ["sky", "scenery/trees", "scenery/flowers"];

/** 단위 벡터(행성 위 자리) */
export interface UnitVector {
  x: number;
  y: number;
  z: number;
}

/** 배치를 마친 생물 하나: 에셋 키와 자리 */
export interface PlacedCreature {
  key: string;
  v: UnitVector;
}

/**
 * 시작 자리에서 그려질 생물의 에셋 키. 추측하지 않고 실제로 놓인 자리로 고른다 —
 * 생물 프레임과 같은 기준(`v · start > cos`)이라 시작하자마자 보이는 것만 들어간다.
 */
export function nearbyCreatureKeys(
  placed: readonly PlacedCreature[],
  start: UnitVector,
  cos: number = CREATURE_VIEW_COS,
): string[] {
  const keys = new Set<string>();
  for (const c of placed) {
    const d = c.v.x * start.x + c.v.y * start.y + c.v.z * start.z;
    if (d > cos) keys.add(c.key);
  }
  return [...keys];
}

/**
 * 시작 전에 받을 에셋 키: 아바타(몸·입은 부품·고양이) → 하늘·나무·꽃 → 가까운 생물.
 * manifest 에 없는 키는 뺀다(그 자리는 도형으로 남는다).
 */
export function firstScreenKeys(manifest: Manifest, nearbyCreatures: readonly string[]): string[] {
  const keys = new Set<string>([AVATAR_BODY, ...DEFAULT_WEAR, AVATAR_COMPANION]);
  for (const [key, entry] of Object.entries(manifest.assets)) {
    if (FIRST_CATEGORIES.includes(entry.category)) keys.add(key);
  }
  for (const key of nearbyCreatures) keys.add(key);
  return [...keys].filter((key) => Object.hasOwn(manifest.assets, key));
}

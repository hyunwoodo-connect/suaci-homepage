import { AVATAR_BODY, AVATAR_COMPANION } from "@/lib/avatar/parts";

import type { Manifest } from "./manifest";

/** 첫 화면에 늘 받는 분류: 하늘 그림(모델이 아니라 놓인 자리가 없다) */
const FIRST_CATEGORIES = ["sky"];

/**
 * 시작 전에 받을 에셋 키: 아바타(몸·지금 차림의 부품과 무늬(wearing)·고양이) → 하늘 → 시작 화면에 보이는 모델(inView — 게임이 놓인 자리로 고른다).
 * manifest 에 없는 키는 뺀다(그 자리는 도형으로 남는다).
 */
export function firstScreenKeys(
  manifest: Manifest,
  inView: readonly string[],
  wearing: readonly string[],
): string[] {
  const keys = new Set<string>([AVATAR_BODY, ...wearing, AVATAR_COMPANION]);
  for (const [key, entry] of Object.entries(manifest.assets)) {
    if (FIRST_CATEGORIES.includes(entry.category)) keys.add(key);
  }
  for (const key of inView) keys.add(key);
  return [...keys].filter((key) => Object.hasOwn(manifest.assets, key));
}

import type { PartSlot } from "./parts";
import { PART_SLOTS, PARTS } from "./parts";

// 아바타의 차림(룩): 옷장 탭마다 무엇을 골랐는지. 옷(윗옷·치마·신발)은 몸 셰이더가 색·무늬로 덮고, 소품은 뼈에 끼운다.
// 고를 수 있는 것은 이 표가 정한다 — 저장해 둔 값도 이 표에 없으면 기본으로 읽는다

/** 옷 무늬(512px 그림, 에셋 키는 print_<이름>) */
export const PRINTS = ["daisy", "ditsy", "stripe", "patch", "rose", "gingham"] as const;

/** 치마 단색(무늬 대신) */
export const SKIRT_COLORS = [
  "#2b2e2d",
  "#ff5a1f",
  "#ffd400",
  "#1e8fff",
  "#a9ff39",
  "#ff8fbd",
] as const;

/** 신발 색 */
export const SHOE_COLORS = [
  "#2b2e2d",
  "#ff3d2e",
  "#ffd400",
  "#a9ff39",
  "#8a5cff",
  "#b5651d",
] as const;

/** 옷장 탭: 옷 셋과 소품 칸 다섯 */
export const LOOK_TABS = ["top", "bot", "shoe", ...PART_SLOTS] as const;

/** 옷장 탭 하나 */
export type LookTab = (typeof LOOK_TABS)[number];

/** 탭마다 고른 것. '' 는 기본(옷)·없음(소품). 윗옷은 무늬, 치마는 무늬 또는 '#rrggbb', 신발은 '#rrggbb', 소품은 부품 키 */
export type AvatarLook = Record<LookTab, string>;

/** 처음 차림: 까만 단발과 하트 선글라스, 옷은 원래 옷 */
export const DEFAULT_LOOK: Readonly<AvatarLook> = {
  top: "",
  bot: "",
  shoe: "",
  hair: "hair_bob",
  face: "glass_heart",
  ear: "",
  hand: "",
  board: "",
};

/** 꾸미기 씬 배경색: 윗옷 무늬마다 하나(기본 옷은 하늘색) */
export const STUDIO_BG: Readonly<Record<string, string>> = {
  "": "#8fd3ff",
  daisy: "#ffd84a",
  ditsy: "#ffb37a",
  stripe: "#ff9cc6",
  patch: "#c9b8ff",
  rose: "#bfe8c9",
  gingham: "#ffe27a",
};

/** 무늬 이름 → 에셋 키 */
export function printKey(name: string): string {
  return `print_${name}`;
}

/** 이 탭에서 고를 수 있는 것(앞에서부터 옷장 칸 차례). 머리는 맨머리가 없다 */
export function optionsFor(tab: LookTab): string[] {
  if (tab === "top") return ["", ...PRINTS];
  if (tab === "bot") return ["", ...PRINTS, ...SKIRT_COLORS];
  if (tab === "shoe") return ["", ...SHOE_COLORS];
  const parts = Object.keys(PARTS).filter((k) => PARTS[k].slot === tab);
  return tab === "hair" ? parts : ["", ...parts];
}

/** 소품 탭인가 */
export function isPartTab(tab: LookTab): tab is PartSlot {
  return (PART_SLOTS as readonly string[]).includes(tab);
}

/** 아무거나 고른 차림(rand: 0 이상 1 미만) */
export function randomLook(rand: () => number): AvatarLook {
  const look = { ...DEFAULT_LOOK };
  for (const tab of LOOK_TABS) {
    const options = optionsFor(tab),
      r = rand(),
      spread = r * options.length,
      at = Math.floor(spread),
      last = options.length - 1;
    look[tab] = options[Math.min(at, last)];
  }
  return look;
}

/** 저장해 둔 차림을 읽는다: 탭마다 표에 있는 값만 받고, 없거나 모르는 값은 기본으로 */
export function readLook(raw: unknown): AvatarLook {
  const look = { ...DEFAULT_LOOK };
  if (typeof raw !== "object" || raw === null) return look;
  const rec = raw as Record<string, unknown>;
  for (const tab of LOOK_TABS) {
    const v = rec[tab];
    if (typeof v === "string" && optionsFor(tab).includes(v)) look[tab] = v;
  }
  return look;
}

/** 차림이 받아야 할 에셋 키(끼운 부품과 입은 무늬) */
export function lookAssetKeys(look: Readonly<AvatarLook>): string[] {
  const keys = PART_SLOTS.map((slot) => look[slot]).filter((k) => k !== "");
  for (const v of [look.top, look.bot]) {
    if (!isPrint(v)) continue;
    const key = printKey(v);
    keys.push(key);
  }
  return keys;
}

/** 무늬 이름인가 */
export function isPrint(v: string): boolean {
  return (PRINTS as readonly string[]).includes(v);
}

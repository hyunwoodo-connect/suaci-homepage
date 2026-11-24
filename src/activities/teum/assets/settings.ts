import type { GameEventMap, GameEventName, RideName } from "../game/events";

// 에셋 종류마다의 설정(종류·굽기·생물·색조 tint·줄무늬 pat·조형물 목록)을 한곳에 둔다.
// 생물·조형물을 늘릴 때: 파일을 raw/ 에 넣고 → tools/catalog.mjs 에 한 줄 → 여기 표에 한 줄.
// 소리도 같다: 파일을 raw/ 에 넣고 → catalog 의 audio 분류에 한 줄 → 아래 SOUND_EFFECTS(또는 BACKGROUND_MUSIC)에 한 줄.

/** 색조: 에셋 키 → [정해진 색, 세기]. 에셋의 명암은 두고 색만 바꾼다(흰 부분은 희게 남는다) */
export const MODEL_TINT: Readonly<Record<string, readonly [number, number]>> = {
  brabbit: [0xff3d8f, 1],
  d_cake: [0xff4f9a, 1],
  d_macaron: [0xff8fbd, 1],
  d_teacup: [0xff8fbd, 1],
  d_fruitpile: [0xff7a4a, 1],
  d_smileflower: [0xff8fbd, 1],
  d_flowerpile: [0xff4f9a, 1],
  d_hotairballoon: [0xff5a1f, 1],
  tree_pink: [0xff4f9a, 1],
  tree_white: [0xffffff, 1],
  tree_yellow: [0xff8fbd, 1],
  flower_pink: [0xff4f9a, 1],
  flower_blue: [0xffffff, 1],
  fountain: [0xffffff, 1],
  gacha: [0xff5a1f, 1],
  lighthouse: [0xff4f9a, 1],
  stairs: [0xff8fbd, 1],
  moon: [0xffffff, 1],
  island: [0xff8fbd, 1],
  dome: [0xff4f9a, 1],
  slide: [0xff8a2b, 1],
  cannon: [0xff5a1f, 1],
  bell: [0xff5a1f, 1],
  bumper: [0xff5a1f, 1],
  balloon: [0xff8a2b, 1],
  star: [0xff8a2b, 1],
  flowerpile: [0x8a5cff, 1],
  flamingo: [0x8a5cff, 1],
  petalbench: [0x8a5cff, 1],
  smileflower: [0xa98bff, 1],
  fountaintower: [0x3f8cff, 1],
  ducktube: [0x3f8cff, 1],
  boat: [0x3f8cff, 1],
  lifering: [0x3f8cff, 1],
  fruitpile: [0xff7a4a, 1],
  hotairballoon: [0xff7a4a, 1],
  picnic: [0xff7a4a, 1],
  fruitcrate: [0xff7a4a, 1],
  cake: [0xff4f9a, 1],
  candycart: [0xff4f9a, 1],
  teacup: [0xff8fbd, 1],
  macaron: [0xff8fbd, 1],
  startower: [0xb07cff, 1],
  observatory: [0xb07cff, 1],
  moonswing: [0xb07cff, 1],
  tent: [0xb07cff, 1],
  sofa: [0xff4f9a, 1],
  busstop: [0xff4f9a, 1],
  parasol: [0xff4f9a, 1],
  bathtub: [0xff8fbd, 1],
  hammock: [0xff8fbd, 1],
  mailbox: [0xff4f9a, 1],
  pod: [0xff8fbd, 1],
  door: [0xff8fbd, 1],
  knittree: [0xff8fbd, 1],
  gumdrops: [0xff4f9a, 1],
};

/** 줄기 세로 줄무늬: 에셋 키 → [줄무늬가 끝나는 높이(모델 기준), 줄 색]. 위는 색조, 아래는 이 색과 흰색 열 줄 */
export const MODEL_STRIPES: Readonly<Record<string, readonly [number, number]>> = {
  tree_pink: [0.6, 0xff4f9a],
  tree_white: [0.68, 0xff4f9a],
  tree_yellow: [0.5, 0xff4f9a],
};

/** 라임 과일: 과일 껍질의 초록이 아니라 늘 키컬러로 칠한다(조명에도 밀리지 않는다) */
export const LIME_FRUITS = new Set(["lime", "lime_half"]);

/** 생물의 버릇 — 생김새만 다르고 하는 짓이 같으면 만나는 재미가 없어서 종마다 끼운다(game/creatures/habits) */
export type HabitName =
  | "pour"
  | "springy"
  | "fallOver"
  | "roll"
  | "bow"
  | "spin"
  | "hopForJoy"
  | "lead"
  | "bolt"
  | "visit";

/** 생물 한 종류의 설정. 새 종은 에셋 + 이 표에 한 줄(필요하면 버릇 하나)로 끝난다 */
export interface CreatureSetting {
  /** 뼈대 없이 몸을 휘는 방식: 1 네발 걸음·고갯짓, 2 꼬리 헤엄, 3 날갯짓, 4 해파리 갓과 자루, 5 두 발 */
  motion: 1 | 2 | 3 | 4 | 5;
  /** 앞이 +x 를 보게, 기운 것은 바로 서게 받을 때 미리 돌리는 각(Euler x·y·z) */
  bake?: readonly [number, number, number];
  /** 땅 위 무리로 나온다(이 표의 차례대로 마을·떠도는 무리에 돌아가며): 키 크기·걸음(walk 걷기, hop 통통)·마릿수 */
  herd?: { size: number; gait: "walk" | "hop"; count: number };
  /** 하늘을 셋씩 도는 무리로 나온다(이 표의 차례대로 돌려 쓴다): 너비 크기 */
  sky?: { size: number };
  /** 호수에서 헤엄친다(이 표의 차례대로 돌려 쓴다): 앞뒤 길이 크기 */
  lake?: { size: number };
  /** 하늘을 떠다니는 해파리: 키 크기 */
  jelly?: { size: number };
  /**
   * 전설: 자리를 옮기지 않는 드문 손님. 걷는 것(ground)과 하늘을 도는 것(sky)이 있다.
   * 어디에 몇 곳인지는 지도가 정한다(GameMap.creatures.legends)
   */
  legend?: {
    size: number;
    by: "h" | "z";
    kind: "ground" | "sky";
  };
  /** 종마다의 버릇(끼우는 차례대로 돈다) */
  habits?: readonly HabitName[];
}

/** 생물 설정. 무리·하늘·호수로 나오는 것은 이 표의 차례대로 돌려 쓴다 — 차례가 배치를 정하므로 바꾸지 않는다 */
export const CREATURES: Readonly<Record<string, CreatureSetting>> = {
  teapot: {
    motion: 1,
    bake: [0, -Math.PI / 2, 0],
    herd: { size: 2.5, gait: "walk", count: 3 },
    habits: ["pour"],
  },
  c_watch: { motion: 5, herd: { size: 2.4, gait: "walk", count: 3 }, habits: ["lead"] },
  card: { motion: 5, herd: { size: 2.8, gait: "walk", count: 4 }, habits: ["fallOver"] },
  c_hat: { motion: 5, herd: { size: 2.6, gait: "hop", count: 3 }, habits: ["bow"] },
  mushroom: {
    motion: 5,
    bake: [0, 0, -0.42],
    herd: { size: 2.5, gait: "hop", count: 3 },
    habits: ["springy"],
  },
  c_rose: { motion: 5, herd: { size: 2.7, gait: "walk", count: 3 }, habits: ["spin"] },
  brabbit: { motion: 1, bake: [0, -Math.PI / 2, 0], herd: { size: 2.7, gait: "hop", count: 2 } },
  c_dice: { motion: 5, herd: { size: 2.2, gait: "walk", count: 4 }, habits: ["roll"] },
  c_cupcake: { motion: 5, herd: { size: 2.4, gait: "walk", count: 3 }, habits: ["hopForJoy"] },
  bfish: { motion: 2, bake: [0, -Math.PI / 2, 0], lake: { size: 3.0 } },
  key: { motion: 3, bake: [0, -Math.PI / 2, 0], sky: { size: 2.2 } },
  umbrella: { motion: 4, jelly: { size: 4.4 } },
  c_wheart: { motion: 3, sky: { size: 2.1 }, habits: ["visit"] },
  c_wcrown: {
    motion: 3,
    legend: { size: 6, by: "z", kind: "sky" },
    habits: ["visit"],
  },
  c_deer: {
    motion: 1,
    bake: [0, -Math.PI / 2, 0],
    legend: { size: 5.2, by: "h", kind: "ground" },
    habits: ["bolt"],
  },
  c_wletter: { motion: 3, sky: { size: 2.1 }, habits: ["visit"] },
  c_wcup: { motion: 3, sky: { size: 2.1 }, habits: ["visit"] },
  c_wbell: { motion: 3, sky: { size: 2.1 }, habits: ["visit"] },
  c_narwhal: { motion: 2, bake: [0, -Math.PI / 2, 0], lake: { size: 3.6 } },
  c_seal: { motion: 2, bake: [0, -Math.PI / 2, 0], lake: { size: 3.6 } },
};

/** 받을 때 미리 돌려 두는 모델(앞이 +x, 기운 것은 바로 서게): 키 → Euler x·y·z */
export const MODEL_BAKE: Readonly<Record<string, readonly [number, number, number]>> =
  Object.fromEntries(
    Object.entries(CREATURES).flatMap(([k, c]) => (c.bake ? [[k, c.bake] as const] : [])),
  );

/** 조형물 한 종류의 설정 */
interface SculptureSetting {
  /** large: 14 이상 크게 놓는 것, small: 그보다 작게 놓는 것 */
  size: "large" | "small";
  /** 막지 않는 문: 지나가면 휙 빨라진다(도넛·사탕 문) */
  isGate?: boolean;
  /** 곁에 가면 돈다(팽이) */
  isSpinning?: boolean;
  /** 꼭대기를 밟으면 튀는 높이 배율(푸딩은 더 높이) */
  bounce?: number;
}

/** 조형물 설정. 고르는 순서가 배치를 정하므로 순서를 바꾸지 않는다 */
export const SCULPTURES: Readonly<Record<string, SculptureSetting>> = {
  d_cake: { size: "small" },
  d_macaron: { size: "small" },
  d_teacup: { size: "small" },
  d_fruitpile: { size: "small" },
  d_smileflower: { size: "small" },
  d_flowerpile: { size: "small" },
  s_rook: { size: "large" },
  s_icecream: { size: "large" },
  s_lollipop: { size: "large" },
  s_donut: { size: "large", isGate: true },
  s_heart: { size: "large" },
  s_bow: { size: "large" },
  s_cherry: { size: "large" },
  s_pudding: { size: "large", bounce: 1.5 },
  s_arch: { size: "large", isGate: true },
  s_crown: { size: "large" },
  s_gift: { size: "large" },
  s_top: { size: "large", isSpinning: true },
};

/** 키 큰 솜사탕 나무: 에셋 키 → 갓이 시작하는 높이(키 대비) */
export const TREE_CROWN_BASE: Readonly<Record<string, number>> = {
  tree_pink: 0.66,
  tree_white: 0.72,
  tree_yellow: 0.55,
};

/** 마을마다 피는 큰 풍선 꽃 */
export const BIG_FLOWERS = ["flower_pink", "flower_blue"] as const;

/** 땅 위 무리로 나오는 생물(이 차례대로 돌려 쓴다) */
export function herdSpecies(): {
  key: string;
  size: number;
  gait: "walk" | "hop";
  count: number;
}[] {
  return Object.entries(CREATURES).flatMap(([key, c]) => (c.herd ? [{ key, ...c.herd }] : []));
}

/** 하늘을 셋씩 도는 무리로 나오는 생물(이 차례대로 돌려 쓴다) */
export function skySpecies(): { key: string; size: number }[] {
  return Object.entries(CREATURES).flatMap(([key, c]) => (c.sky ? [{ key, ...c.sky }] : []));
}

/** 호수에서 헤엄치는 생물(이 차례대로 돌려 쓴다) */
export function lakeSpecies(): { key: string; size: number }[] {
  return Object.entries(CREATURES).flatMap(([key, c]) => (c.lake ? [{ key, ...c.lake }] : []));
}

/** 크기 갈래(large·small)의 조형물 키(순서대로) */
export function sculptureKeys(size: SculptureSetting["size"]): string[] {
  return Object.entries(SCULPTURES)
    .filter(([, s]) => s.size === size)
    .map(([key]) => key);
}

// ---- 소리 ----

/** 소리 채널: 배경 음악(bgm)과 효과음(sfx) — 크기를 따로 정한다 */
export type SoundChannel = "bgm" | "sfx";

/**
 * 소리 한 번: manifest 의 소리 에셋 키(분류 audio/…), 크기(0..1, 없으면 0.6), 빠르기(음높이 — 수 하나 또는 [가장 낮게, 가장 높게] 사이 아무거나),
 * 같은 소리를 다시 내기까지 쉬는 시간(초, 없으면 0.05), 늦게 내기(초)
 */
export interface SoundCue {
  key: string;
  volume?: number;
  rate?: number | readonly [number, number];
  gap?: number;
  delay?: number;
}

/** 일어난 일 하나에 낼 소리: 늘 같은 소리, 여러 소리, 또는 그 일의 값을 보고 고르는 규칙(null 이면 소리 없음) */
export type SoundRule<K extends GameEventName> =
  | SoundCue
  | readonly SoundCue[]
  | ((payload: GameEventMap[K]) => SoundCue | readonly SoundCue[] | null);

/** 일어난 일 → 소리 */
export type SoundTable = { readonly [K in GameEventName]?: SoundRule<K> };

/** 놀이기구가 붙잡을 때 — 미끄럼틀은 소리 없음 */
const GRAB_SOUND: Readonly<Partial<Record<RideName, SoundCue>>> = {
  rocket: { key: "snd_rocket", volume: 0.6 },
  cannon: { key: "snd_cannon", volume: 0.7 },
  funnel: { key: "snd_rail", volume: 0.5, rate: 0.75 },
  whirl: { key: "snd_up", volume: 0.5, rate: 0.7 },
  whale: { key: "snd_whale", volume: 0.6 },
  comet: { key: "snd_legend", volume: 0.4, rate: 0.8 },
  swing: { key: "snd_boing", volume: 0.4, rate: 1.2 },
  hole: { key: "snd_palin", volume: 0.6, rate: 0.7 },
  sling: { key: "snd_up", volume: 0.5, rate: 1.3 },
};

/** 생물 인사: 몸 휘는 방식(motion)마다 소리, 두 발(5)은 통통 튀는 소리. 종마다 음높이가 조금씩 다르다 */
const GREET_SOUND: Readonly<Record<number, string>> = {
  1: "snd_quad",
  2: "snd_swim",
  3: "snd_wing",
  4: "snd_jelly",
};

/**
 * 일어난 일(game/events) → 효과음.
 * 바람 반복음(snd_wind)은 '숨소리 같다'는 지적으로 꺼 두었다(파일은 manifest 에 있다)
 */
export const SOUND_EFFECTS: SoundTable = {
  grabbed: ({ by }) => GRAB_SOUND[by] ?? null,
  hung: { key: "snd_boing", volume: 0.5, rate: 1.5 },
  railed: { key: "snd_rail", volume: 0.5 },
  whaleNear: { key: "snd_whale", volume: 0.5, rate: 0.9, gap: 5 },
  rose: { key: "snd_up", volume: 0.45, rate: [0.9, 1.15], gap: 0.5 },
  landed: { key: "snd_boing", volume: 0.3, rate: 0.6, gap: 0.3 },
  // 빛 방울이 튀는 모든 곳: 가까울수록 크게(45m 밖은 없음)
  sparkled: ({ n, dist }) => {
    if (n < 5 || dist > 45) return null;
    const near = 1 - dist / 45;
    return { key: "snd_ring", volume: 0.06 + 0.2 * near, rate: [0.8, 1.7], gap: 0.09 };
  },
  splashed: ({ dist }) =>
    dist < 40 ? { key: "snd_splash", volume: 0.4, rate: [0.9, 1.2], gap: 0.25 } : null,
  creatureMet: ({ kind, legend }) => {
    if (legend) return { key: "snd_legend", volume: 0.6, gap: 2 };
    const pitch = speciesPitch(kind),
      motion = CREATURES[kind]?.motion ?? 1;
    if (motion === 5) return { key: "snd_boing", volume: 0.45, rate: 1.3 + pitch * 0.08, gap: 0.2 };
    return { key: GREET_SOUND[motion], volume: 0.5, rate: 0.82 + pitch * 0.07, gap: 0.2 };
  },
  landmarkTalked: { key: "snd_quad", volume: 0.5, rate: 0.55, gap: 0.3 },
  regionEntered: { key: "snd_legend", volume: 0.35, rate: 1.2, gap: 3 },
  outfitPicked: ({ random }) =>
    random
      ? { key: "snd_pick", volume: 0.5, rate: 1.2 }
      : { key: "snd_pick", volume: 0.4, rate: 1.4 },
  // 방울 길: 터뜨릴 때마다 한 음씩 오르고, 마지막 방울은 튕겨 오르는 소리
  trailBubblePopped: ({ step, last }) =>
    last
      ? { key: "snd_up", volume: 0.5, rate: 1.25 }
      : { key: "snd_pick", volume: 0.32, rate: 1 + 0.12 * step, gap: 0.03 },
  // 물풍선: 터지는 물소리에, 먹은 수만큼 조금씩 높아지는 울림(첫 개 0.9 → 마지막 1.5)
  waterBalloonPopped: ({ count, total }) => {
    const rest = total - 1,
      steps = Math.max(1, rest),
      progress = (count - 1) / steps;
    return [
      { key: "snd_splash", volume: 0.5, rate: 1.3 },
      { key: "snd_ring", volume: 0.5, rate: 0.9 + 0.6 * progress },
    ];
  },
  // 마지막 물풍선의 물소리가 지나간 뒤에
  waterBalloonsCleared: { key: "snd_win", volume: 0.7, delay: 0.25 },
};

/** 배경 음악(되풀이) */
export const BACKGROUND_MUSIC: SoundCue | null = { key: "snd_bgm", volume: 0.3 };

/** 채널 크기(0..1) */
export const SOUND_VOLUME: Readonly<Record<SoundChannel, number>> = { bgm: 1, sfx: 1 };

/* ─── 내부 ─────────────────────────── */

// 종 키마다 고정된 음높이 칸(0..7) — 글자 해시라 판마다 같다
function speciesPitch(kind: string): number {
  let hash = 0;
  for (let i = 0; i < kind.length; i++) {
    const code = kind.charCodeAt(i);
    hash = (hash * 31 + code) % 97;
  }
  return hash % 8;
}

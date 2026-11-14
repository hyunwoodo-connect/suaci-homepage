// 에셋 종류마다의 설정. 시제품 곳곳에 있던 표(KIND·BAKE·SP·색조 tint·줄무늬 pat·조형물 목록)를 한곳에 모았다.
// 생물·조형물을 늘릴 때: 파일을 raw/ 에 넣고 → tools/catalog.mjs 에 한 줄 → 여기 표에 한 줄.

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
  slide: [0xffd21f, 1],
  cannon: [0xff5a1f, 1],
  bell: [0xff5a1f, 1],
  bumper: [0xff5a1f, 1],
  balloon: [0xffd21f, 1],
  star: [0xffd21f, 1],
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

/** 그늘에서도 쨍하게 스스로 빛나는 라임 */
export const GLOWING_LIME = new Set(["lime", "lime_half"]);

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
   * 전설: 온 행성에 세 곳뿐이고 자리를 옮기지 않는다. 자리는 [마을, 거리, 방향].
   * 걷는 것(ground)과 하늘을 도는 것(sky)이 있다
   */
  legend?: {
    size: number;
    by: "h" | "z";
    kind: "ground" | "sky";
    at: readonly (readonly [number, number, number])[];
  };
  /** 종마다의 버릇(끼우는 차례대로 돈다) */
  habits?: readonly HabitName[];
}

/** 생물 설정. 무리·하늘·호수로 나오는 것은 이 표의 차례대로 돌려 쓴다(시제품 SP·FLK·호수 순서) */
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
    legend: {
      size: 6,
      by: "z",
      kind: "sky",
      at: [
        [0, 380, 130],
        [2, 340, 300],
        [4, 360, 20],
      ],
    },
    habits: ["visit"],
  },
  c_deer: {
    motion: 1,
    bake: [0, -Math.PI / 2, 0],
    legend: {
      size: 5.2,
      by: "h",
      kind: "ground",
      at: [
        [1, 330, 40],
        [3, 350, 200],
        [5, 300, 120],
      ],
    },
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
export interface SculptureSetting {
  /** large: 14 이상 크게 놓는 것, small: 그보다 작게 놓는 것 */
  size: "large" | "small";
  /** 막지 않는 문: 지나가면 휙 빨라진다(도넛·사탕 문) */
  isGate?: boolean;
  /** 곁에 가면 돈다(팽이) */
  isSpinning?: boolean;
  /** 꼭대기를 밟으면 튀는 높이 배율(푸딩은 더 높이) */
  bounce?: number;
}

/** 조형물 설정. 고르는 순서가 배치를 정하므로 순서를 바꾸지 않는다(시제품 DK·DKB 순서) */
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

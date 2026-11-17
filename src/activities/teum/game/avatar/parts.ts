// 아바타 꾸미기 부품. 몸은 그대로 두고 뼈에 부품을 끼운다. 칸(slot)마다 하나씩, 같은 칸에 새로 끼우면 바뀐다.
// 부품을 늘리려면 avatar/<칸> 분류로 에셋을 빌드하고(옷장 칸 그림은 avatar/thumbs 의 thumb_<이름>) PARTS 에 한 줄만 더하면 된다.
// 숫자는 머리·손 크기에 대한 비율이고, 모두 눈으로 맞춘 값이다(폰 크기 화면에서 다시 본 값)

/** 뼈대가 있는 몸 에셋 */
export const AVATAR_BODY = "SUACI_AV";

/**
 * 몸 에셋(처음 선 자세 — 키 1.2, 팔을 옆(±z)으로 비스듬히 내림)에서 소매가 끝나는 곳: |z| 가 이보다 크면 손이다.
 * 자동 뼈대의 손뼈는 보이는 손에서 떨어져 있어서, 손에 드는 것과 윗옷 무늬는 이 값으로 손을 찾는다
 */
export const HAND_FROM_Z = 0.377;

/** 몸 에셋에서 목이 시작하는 높이: 이 위의 살빛은 윗옷이 아니다(목폴라 깃은 분홍이라 그대로 윗옷) */
export const NECK_FROM_Y = 0.78;

/** 곁에 떠 다니는 고양이 에셋 */
export const AVATAR_COMPANION = "cat_lime";

/** 부품을 끼우는 칸: 머리, 얼굴, 귀(좌우 한 쌍), 손에 든 것, 발밑 */
export const PART_SLOTS = ["hair", "face", "ear", "hand", "board"] as const;

/** 부품 칸 */
export type PartSlot = (typeof PART_SLOTS)[number];

/**
 * 부품 하나가 어디에 어떻게 붙나:
 * hair — 머리 너비 대비 폭(w), 머리 꼭대기에서 얹는 높이(top, 머리 높이 비율), 앞으로 나온 정도(f, 머리 깊이 비율)
 * face — 폭(w), 머리 가운데 기준 높이(y), 얼굴 앞으로 나오는 정도(f)
 * ear  — 머리 높이 대비 길이(h), 머리 가운데 기준 높이(y)
 * hand — 드는 손뼈, 가장 긴 변의 길이(size, 몸 기준), 늘어뜨려 드는지(hang — 가방)
 * board — 판의 길이(len, 몸 기준)
 */
export type PartFit =
  | { slot: "hair"; w: number; top: number; f?: number }
  | { slot: "face"; w: number; y: number; f: number }
  | { slot: "ear"; h: number; y: number }
  | { slot: "hand"; bone: "RightHand" | "LeftHand"; size: number; hang?: boolean }
  | { slot: "board"; len: number };

/** 끼울 수 있는 부품(키 = 에셋 키) */
export const PARTS: Readonly<Record<string, PartFit>> = {
  hair_bob: { slot: "hair", w: 1.16, top: 0.04 },
  scarf: { slot: "hair", w: 1.19, top: 0.56, f: -0.06 },
  glass_heart: { slot: "face", w: 0.9, y: -0.2, f: 0.1 },
  sunglass: { slot: "face", w: 0.84, y: -0.2, f: 0.13 },
  earring: { slot: "ear", h: 0.46, y: -0.14 },
  bouquet: { slot: "hand", bone: "RightHand", size: 0.27 },
  bag: { slot: "hand", bone: "LeftHand", size: 0.27, hang: true },
  board: { slot: "board", len: 0.82 },
};

/** 옷장 칸에 보이는 부품 그림의 에셋 키 */
export function thumbKey(part: string): string {
  return `thumb_${part}`;
}

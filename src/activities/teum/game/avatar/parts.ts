// 아바타 꾸미기 부품. 몸은 그대로 두고 머리뼈에 부품을 끼운다. 칸(slot)마다 하나씩, 같은 칸에 새로 끼우면 바뀐다.
// 부품을 늘리려면 avatar/hair·avatar/face 분류로 에셋을 빌드하고 PARTS 에 한 줄만 더하면 된다

/** 뼈대가 있는 몸 에셋 */
export const AVATAR_BODY = "SUACI_AV";

/** 곁에 떠 다니는 고양이 에셋 */
export const AVATAR_COMPANION = "cat_lime";

/** 부품 하나: 칸, 머리 너비 대비 폭(w), 머리 위로 얹는 높이(top, 머리카락), 머리 높이 기준 위치(y), 얼굴 앞으로 나오는 정도(f) */
export interface PartFit {
  slot: "hair" | "face";
  w: number;
  top?: number;
  y?: number;
  f?: number;
}

/** 끼울 수 있는 부품 */
export const PARTS: Readonly<Record<string, PartFit>> = {
  hair_bob: { slot: "hair", w: 1.16, top: 0.04 },
  glass_heart: { slot: "face", w: 1.0, y: -0.08, f: 0.03 },
};

/** 처음에 입는 부품(이 순서로 끼운다): 까만 단발, 라임 하트 선글라스 */
export const DEFAULT_WEAR = ["hair_bob", "glass_heart"] as const;

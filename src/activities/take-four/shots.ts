/** 카드 한 장의 네 칸(0~3). 칸을 도는 순서 */
export const SHOT_INDEXES = [0, 1, 2, 3] as const;

/** 찰칵 전 지시 문구 */
export const READY_PROMPT = "액자 안으로 들어오세요";

/** 장마다 지시 문구(그대로) */
export const PROMPTS = [
  "정색해 주세요~",
  "살짝 웃어 주세요",
  "방긋 웃어 주세요",
  "빵 터져 주세요~",
] as const;

/** 시안 Album의 칸 이름 */
export const SHOT_NAMES = ["무표정", "살짝 미소", "방긋", "박장대소"] as const;

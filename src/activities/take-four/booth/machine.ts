/** 부스 단계. ready(찰칵 전) → count(3·2·1) → flash(찰칵) → 다음 장 count … → done */
export type BoothStep = "ready" | "count" | "flash" | "done";

/** 촬영 상태. shot은 지금 찍는 장(0~3), 다 찍으면 4 */
export interface BoothState {
  step: BoothStep;
  shot: 0 | 1 | 2 | 3 | 4;
  count: 3 | 2 | 1;
}

export type BoothAction = { type: "start" } | { type: "tick" } | { type: "reset" };

export const BOOTH_INITIAL: BoothState = { step: "ready", shot: 0, count: 3 };

/** 숫자 하나가 머무는 시간 */
export const COUNT_MS = 800;
/** 찰칵 흰 빛이 머무는 시간 */
export const FLASH_MS = 260;

/** 장마다 지시 문구(그대로). 다 찍으면 `take suaci.` */
export const PROMPTS = [
  "정색해 주세요~",
  "살짝 웃어 주세요",
  "방긋 웃어 주세요",
  "빵 터져 주세요~",
] as const;

/** 시안 Shot1~4의 카메라 화면 이름 */
export const SHOT_NAMES = ["무표정", "살짝 미소", "방긋", "박장대소"] as const;

/** 시안 Booth.dc.html의 tick 규칙 그대로. */
export function boothReducer(state: BoothState, action: BoothAction): BoothState {
  switch (action.type) {
    case "start":
      return state.step === "ready" ? { step: "count", shot: 0, count: 3 } : state;
    case "reset":
      return BOOTH_INITIAL;
    case "tick":
      if (state.step === "count") {
        if (state.count === 3) return { ...state, count: 2 };
        if (state.count === 2) return { ...state, count: 1 };
        return { ...state, step: "flash" };
      }
      if (state.step === "flash") {
        if (state.shot === 3) return { ...state, step: "done", shot: 4 };
        return { step: "count", shot: (state.shot + 1) as 1 | 2 | 3, count: 3 };
      }
      return state;
  }
}

/** 지금 상태에서 다음 tick까지 기다릴 시간. 멈춘 상태(ready·done)면 null */
export function tickDelay(state: BoothState): number | null {
  if (state.step === "count") return COUNT_MS;
  if (state.step === "flash") return FLASH_MS;
  return null;
}

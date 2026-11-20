import { hideSeekGame } from "./hideseek";
import type { MinigameFactory } from "./registry";

// 등록된 미니게임: 존 설정의 minigame 값이 여기 이름이어야 한다

/** id → 게임 */
export const MINIGAMES: Readonly<Record<string, MinigameFactory>> = {
  hideseek: hideSeekGame,
};

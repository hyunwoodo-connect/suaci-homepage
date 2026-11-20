import type { Minigame, MinigameLinks, MinigameStage } from "./registry";

// 첫 등록 게임 — 숨바꼭질(간식 존). 정원 숨바꼭질 판(MAP-02 8장 · 숨는 자리 hideSpot 12)은 간식 존 판정 뒤에 붙인다:
// 그때까지는 열 준비가 안 된 것으로 둔다(시작 자리는 보이지만 올라서도 판이 서지 않는다).
// 판을 띄우는 지도(v78)의 숨바꼭질은 예전처럼 광장에서 스스로 돈다 — 이 입구를 거치지 않는다

/** 숨바꼭질을 미니게임 입구에 잇는다 */
export function hideSeekGame(links: MinigameLinks): Minigame {
  const isMapReady = links.s.map.hideSeek !== false && links.s.map.zoneConfigs === undefined;
  let stage: MinigameStage | null = null;
  return {
    isReady: isMapReady,
    get isOver() {
      return stage !== null && !links.hideSeek.isRoundOn;
    },
    start(at) {
      stage = at;
    },
    stop() {
      stage = null;
    },
  };
}

import type * as THREE from "three";

import type { Services } from "../services";

// 미니게임 등록(오너 2026-11-20 3번): id → 게임. 존 설정의 minigame 이 이 id 를 고르고, 미니게임 입구가 연다.
// 새 게임은 Minigame 을 만들어 MINIGAMES 에 한 줄. 숨바꼭질이 첫 등록 게임이다(minigame/hideseek)

/** 판을 펴는 자리: 존 · 랜드마크 · 시작 자리 · 게임 마당 반지름(m — 판 동안 이 밖으로 못 나간다) */
export interface MinigameStage {
  zone: string;
  landmark: THREE.Vector3;
  start: THREE.Vector3;
  gameR: number;
}

/** 미니게임 하나 */
export interface Minigame {
  /** 지금 열 수 있나(이 지도에 판을 띄울 준비가 됐나) */
  readonly isReady: boolean;
  /** 판이 끝났나 */
  readonly isOver: boolean;
  /** 판을 시작한다 */
  start(stage: MinigameStage): void;
  /** 판을 접고 자유 놀이로 */
  stop(): void;
}

/** 게임을 만드는 데 쓰는 것: 공용 창구와, 게임마다 이미 있는 부품(숨바꼭질 판 등) */
export interface MinigameLinks {
  s: Services;
  /** 숨바꼭질(이미 지은 것) */
  hideSeek: { readonly isRoundOn: boolean };
}

/** id → 게임 만드는 함수 */
export type MinigameFactory = (links: MinigameLinks) => Minigame;

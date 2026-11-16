import type * as THREE from "three";

import type { CatScent } from "../avatar/avatar";
import type { HideOverlay } from "./overlay";
import { HIDE } from "./tuning";

// 다음에 갈 곳을 알려 주는 것 둘:
//   고양이 — 옆을 따라다니는 라임 고양이가 가장 가까운 숨은 상자까지의 거리로 몸짓과 머리 위 표시(… · ! · !!)를 바꾼다(cat.far·mid·near)
//   한 줄 안내 — 첫 판에만, 한 번에 하나. 고양이가 처음 냄새를 맡으면 '고양이가 냄새를 맡았어', 둘째 상자부터 숨은 상자 가까이 오면 '톡'
//   (칙을 한 번 쏘면 '톡'은 다시 뜨지 않는다)

/** 옆을 따라다니는 고양이: 맡은 냄새(상자가 가까운 정도와 있는 쪽) · 머리 위 자리 */
export interface CatLink {
  setCatScent(level: CatScent, toward: THREE.Vector3 | null): void;
  catHead(out: THREE.Vector3): THREE.Vector3;
}

/** 고양이 머리 위 냄새 표시(멀다 → 바로 곁) · '고양이가 냄새를 맡았어'가 뜨는 때(찾기 시작 뒤 초)와 떠 있는 시간(초) */
const CAT_MARKS = [null, "…", "!", "!!"] as const,
  CAT_HINT_AFTER = 2,
  CAT_HINT_TIME = 3.5;

/** 고양이와 한 줄 안내 */
export class Coach {
  /** 칙을 쏴 봤나 · '톡'을 띄울 때가 왔나 · 고양이 안내를 했나와 남은 시간(초) · 지금 떠 있는 글 · 고양이가 지금 맡은 냄새 */
  private chikEver = false;
  private tapHint = false;
  private catHinted = false;
  private catHintLeft = 0;
  private hint: string | null = null;
  private scent: CatScent = 0;

  constructor(
    private readonly overlay: HideOverlay,
    private readonly cat: CatLink,
  ) {}

  /** 판 시작: 안내 줄과 고양이 표시를 거둔다 */
  begin() {
    this.showHint(null);
    this.smell(0, null);
    this.catHintLeft = 0;
  }

  /** 칙을 쐈다 */
  chik() {
    this.chikEver = true;
  }

  /** 고양이가 냄새를 맡는다: 가장 가까운 숨은 상자(toward — 없으면 null)까지 수평 거리 dist(m). 첫 판에 처음 맡으면 한 번 안내한다 */
  sniff(toward: THREE.Vector3 | null, dist: number, isFirst: boolean, roundT: number) {
    const C = HIDE.cat;
    const level: CatScent = dist <= C.near ? 3 : dist <= C.mid ? 2 : dist <= C.far ? 1 : 0;
    this.smell(level, toward);
    if (!isFirst || this.catHinted || level === 0 || roundT < CAT_HINT_AFTER) return;
    this.catHinted = true;
    this.catHintLeft = CAT_HINT_TIME;
  }

  /** 한 줄 안내(첫 판에만): found 는 지금까지 찾은 수, isNearHidden 은 숨은 상자 곁인가 */
  teach(isFirst: boolean, found: number, isNearHidden: boolean, dt: number) {
    if (!isFirst) return;
    if (!this.chikEver && found >= 1 && isNearHidden) this.tapHint = true;
    if (this.catHintLeft > 0) this.catHintLeft -= dt;
    const isTapShown = this.tapHint && !this.chikEver,
      isCatShown = this.catHintLeft > 0;
    const text = isCatShown ? HIDE.copy.catSniff : isTapShown ? HIDE.copy.tap : null;
    this.showHint(text);
  }

  /** 찾기가 끝났다: 안내 줄과 고양이 표시를 거둔다 */
  stop() {
    this.showHint(null);
    this.smell(0, null);
  }

  /* ─── 내부 ─────────────────────────── */

  // 고양이의 몸짓과 머리 위 표시를 냄새에 맞춘다(상자가 없으면 표시도 없다)
  private smell(level: CatScent, toward: THREE.Vector3 | null) {
    this.cat.setCatScent(level, toward);
    const shown: CatScent = toward ? level : 0;
    if (shown === this.scent) return;
    this.scent = shown;
    this.overlay.setCatMark(CAT_MARKS[shown], (out) => this.cat.catHead(out));
  }

  private showHint(text: string | null) {
    if (text === this.hint) return;
    this.hint = text;
    this.overlay.showHint(text);
  }
}

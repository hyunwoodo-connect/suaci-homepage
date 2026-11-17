import type * as THREE from "three";

import type { CatScent } from "../avatar/avatar";
import { HIDE } from "./tuning";

// 옆을 따라다니는 라임 고양이가 다음에 할 것을 알려 준다 — 몸짓만으로(머리 위 표시·안내 글은 없다):
// 가장 가까운 숨은 상자까지의 거리로 냄새를 맡는 몸짓을 바꾼다(cat.far 킁킁 · mid 통통 · near 폴짝폴짝, 그쪽으로 몸이 기운다)

/** 옆을 따라다니는 고양이: 맡은 냄새(상자가 가까운 정도와 있는 쪽) · 머리 위 자리(고양이 뒤에 숨는 상자가 따라간다) */
export interface CatLink {
  setCatScent(level: CatScent, toward: THREE.Vector3 | null): void;
  catHead(out: THREE.Vector3): THREE.Vector3;
}

/** 고양이의 냄새 */
export class Coach {
  constructor(private readonly cat: CatLink) {}

  /** 판 시작·끝: 냄새를 거둔다 */
  begin() {
    this.cat.setCatScent(0, null);
  }

  /** 고양이가 냄새를 맡는다: 가장 가까운 숨은 상자(toward — 없으면 null)까지 수평 거리 dist(m) */
  sniff(toward: THREE.Vector3 | null, dist: number) {
    const C = HIDE.cat;
    const level: CatScent = dist <= C.near ? 3 : dist <= C.mid ? 2 : dist <= C.far ? 1 : 0;
    const shown: CatScent = toward ? level : 0;
    this.cat.setCatScent(shown, toward);
  }

  /** 찾기가 끝났다 */
  stop() {
    this.cat.setCatScent(0, null);
  }
}

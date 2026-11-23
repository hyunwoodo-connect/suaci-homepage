import type { TeumSave } from "../progress/save";

/**
 * 지역 hk 의 랜드마크에 왔다: 다녀간 수를 하나 늘리고 온 날을 적는다. 이번이 몇 번째인지 돌려준다(첫 방문은 1).
 * 받은 기록(save)을 그 자리에서 고친다 — 두는 것(commit)은 부르는 쪽이 한다
 */
export function visitLandmark(save: TeumSave, hk: number, day: number): number {
  const m = save.lm[hk] ?? { n: 0, day };
  save.lm[hk] = m;
  m.n++;
  m.day = day;
  return m.n;
}

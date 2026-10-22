import { formatKstDotDate } from "@/lib/event-date";

import { SHOT_INDEXES } from "../shots";

/** 칸 오른쪽 줄 위·아래 끝 글자 */
export const EDGE_WORDS = { top: "take four.", bottom: "suaci" } as const;

/** 칸 하나의 필름 번호. 왼쪽 `▲ 11`, 오른쪽 가운데 `28`. */
export interface EdgeNumbers {
  frame: number;
  edge: number;
}

/** 36장 필름 한 롤 — 넷째 칸이 36을 넘지 않게 첫 칸은 1~33 */
const ROLL = 36;
/** 시안 카드처럼 오른쪽 번호는 ▲ 번호보다 17 크다(11 → 28) */
const EDGE_OFFSET = 17;

/**
 * 네 칸의 필름 번호. 롤 어디쯤인지는 찍은 분(分)으로 정한다 —
 * 같은 네컷은 늘 같은 번호라 현상 화면 미리보기와 저장 카드가 같다.
 */
export function edgeNumbers(takenAt: Date): EdgeNumbers[] {
  const start = (Math.floor(takenAt.getTime() / 60_000) % (ROLL - SHOT_INDEXES.length + 1)) + 1;
  return SHOT_INDEXES.map((i) => ({ frame: start + i, edge: start + i + EDGE_OFFSET }));
}

/** 저장 파일 이름(한국 날짜) */
export function stripFilename(takenAt: Date): string {
  return `take-four-${formatKstDotDate(takenAt).replace(".", "")}.jpg`;
}

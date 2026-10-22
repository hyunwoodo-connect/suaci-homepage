const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Unix ms → KST 기준 `M월 D일`. 서버 시간대와 무관하게 한국 날짜로 보여준다. */
export function formatKoreanMonthDay(ms: number): string {
  const kst = new Date(ms + KST_OFFSET_MS);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}

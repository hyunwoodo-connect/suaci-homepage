const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Unix ms → KST 기준 `M월 D일`. 서버 시간대와 무관하게 한국 날짜로 보여준다. */
export function formatKoreanMonthDay(ms: number): string {
  const kst = new Date(ms + KST_OFFSET_MS);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}

/** Unix ms 또는 Date → KST 기준 `MM.DD`(0 채움). 띠 캡션·안내 화면 도장에 쓴다. */
export function kstDateLabel(date: Date | number): string {
  const kst = new Date(new Date(date).getTime() + KST_OFFSET_MS);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  return `${mm}.${dd}`;
}

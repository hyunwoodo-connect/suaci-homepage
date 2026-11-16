// 숨바꼭질 시험판의 주소 인자. 오너가 미리 보기(운영 빌드)에서 폰으로 바꿔 가며 보므로 debug.ts 와 달리 운영에서도 읽는다.
//   ?hide=1·2·3 숨는 자리 묶음(없으면 1 — 날짜로 뽑는 것은 나중) · ?look=1 멈춰서 둘러보기 · ?debug 끝 화면에 잰 값

/** 숨는 자리 묶음(1 부터). 없거나 잘못된 값이면 1 */
export function hideSet(search: string = location.search): number {
  const raw = new URLSearchParams(search).get("hide");
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** 멈춰서 둘러보기를 켰나(?look=1) */
export function isLookAround(search: string = location.search): boolean {
  return new URLSearchParams(search).get("look") === "1";
}

/** 끝 화면에 잰 값을 보이나(?debug) */
export function isStatsShown(search: string = location.search): boolean {
  return new URLSearchParams(search).has("debug");
}

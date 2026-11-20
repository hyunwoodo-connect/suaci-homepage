// 티타임 행성의 주소 인자. 오너가 미리 보기(운영 빌드)에서 폰으로 열어 보므로 debug.ts 와 달리 운영에서도 읽는다.
// 이 파일은 입구(TeumEntrance)가 게임 코드를 받기 전에 읽는다 — three 를 부르지 않는다.
//   ?planet=tea 이 씬 · &debug=1 상자 상태·숨는 자리·보인다 선을 그린다 · &seed=정수 배치 고정 · &speed=배수 판 시간 배속

/** ?planet=tea 로 열었나(숨바꼭질 행성 v3) */
export function isTeaPlanet(search: string = location.search): boolean {
  return new URLSearchParams(search).get("planet") === "tea";
}

/** &debug=1 (디버그 그림·값) */
export function isTeaDebug(search: string = location.search): boolean {
  const raw = new URLSearchParams(search).get("debug");
  return raw === "1" || raw === "";
}

/** &seed= 고정 씨앗(0 이상 정수). 없거나 깨졌으면 null — 그냥 보통 판 */
export function teaSeed(search: string = location.search): number | null {
  const raw = new URLSearchParams(search).get("seed");
  if (raw === null || !/^\d{1,10}$/.test(raw)) return null;
  const n = Number(raw);
  return n <= 4294967295 ? n : null;
}

/** &speed= 판 시간 배속(0.25~8). 없거나 깨졌으면 1 */
export function teaSpeed(search: string = location.search): number {
  const raw = new URLSearchParams(search).get("speed");
  const n = Number(raw);
  const isValid = raw !== null && Number.isFinite(n) && n >= 0.25 && n <= 8;
  return isValid ? n : 1;
}

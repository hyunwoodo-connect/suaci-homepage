// 티타임 행성의 주소 인자. 오너가 미리 보기(운영 빌드)에서 폰으로 열어 보므로 debug.ts 와 달리 운영에서도 읽는다.
// 이 파일은 입구(TeumEntrance)가 게임 코드를 받기 전에 읽는다 — three 를 부르지 않는다

/** ?planet=tea 로 열었나(숨바꼭질 행성 v3) */
export function isTeaPlanet(search: string = location.search): boolean {
  return new URLSearchParams(search).get("planet") === "tea";
}

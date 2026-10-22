/** 한 API의 세 구현. live는 백엔드 주소로 만든다. */
export interface ApiImpls<T> {
  live: (baseUrl: string) => T;
  /** 로컬 개발·테스트 대역 */
  mock: () => T;
  /** 운영에서 주소가 빠졌을 때 — 가짜 데이터를 내보내지 않는 빈 응답 */
  empty: () => T;
}

/**
 * 이벤트·놀이 API 구현 고르기: 주소가 있으면 live, 없으면 개발·테스트는 mock, 운영은 empty.
 * 운영은 어떤 경우에도 mock을 쓰지 않는다.
 */
export function selectApi<T>(
  impls: ApiImpls<T>,
  baseUrl: string | undefined,
  nodeEnv: string | undefined,
): T {
  if (baseUrl) return impls.live(baseUrl);
  return nodeEnv === "production" ? impls.empty() : impls.mock();
}

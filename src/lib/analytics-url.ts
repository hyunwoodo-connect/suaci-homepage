/**
 * 분석 도구로 보내는 주소. 도구는 기본으로 지금 주소 전체(쿼리 포함)를 보내는데, 우리 주소의 쿼리에는 이메일(비밀번호 재설정)·
 * 로그인 코드·결제 키·미리보기 토큰이 실릴 수 있다. 그래서 GA4 에는 쿼리를 광고 유입값(utm_*)만 남긴 주소를 넘기고,
 * 주소를 바꿀 수 없는 메타 픽셀은 그런 화면에서 아예 보내지 않는다.
 */

/** 남겨도 되는 쿼리 — 광고 유입 표시뿐 */
const KEPT_PARAM = /^utm_(source|medium|campaign|term|content)$/;

/** 쿼리에 비밀이 실리는 화면(언어 접두사를 뺀 경로) — 로그인 콜백·결제 결과·비밀번호 재설정 */
const SENSITIVE_PATH = /^\/(auth|pay|password)(\/|$)/;

/** 미리보기 토큰 같은 비밀 쿼리 이름 */
const SENSITIVE_PARAM = ["preview", "code", "state", "paymentKey", "token"];

/** GA4 에 넘길 주소 — 출처 + 경로 + utm_* 만 */
export function safePageLocation(href: string): string {
  const url = new URL(href);
  const kept = new URLSearchParams();
  url.searchParams.forEach((value, name) => {
    if (KEPT_PARAM.test(name)) kept.append(name, value);
  });
  const query = kept.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}

/** 이 주소에서 메타 픽셀을 보내면 안 되는가(주소 전체가 그대로 실린다) */
export function isSensitiveLocation(href: string): boolean {
  const url = new URL(href);
  const path = url.pathname.replace(/^\/(en|ja)(?=\/|$)/, "") || "/";
  if (SENSITIVE_PATH.test(path)) return true;
  return SENSITIVE_PARAM.some((name) => url.searchParams.has(name));
}

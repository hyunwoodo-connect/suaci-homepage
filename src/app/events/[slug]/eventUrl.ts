/**
 * 이 이벤트 입구의 절대 주소. 인앱 브라우저에서 밖의 브라우저로 넘길 때 쓴다.
 * 쿠키로만 들어온 미리보기도 밖의 브라우저(쿠키 없음)에서 열리도록 토큰을 주소에 다시 붙인다.
 */
export function entranceUrl(
  h: RequestHeaders,
  slug: string,
  previewToken: string | undefined,
): string {
  const query = previewToken ? `?preview=${encodeURIComponent(previewToken)}` : "";
  return `${requestOrigin(h)}/events/${encodeURIComponent(slug)}${query}`;
}

/* ─── 내부 ─────────────────────────── */

/** next/headers의 읽기 전용 헤더도 받는다 */
type RequestHeaders = Pick<Headers, "get">;

const SITE_ORIGIN = "https://takesuaci.com";
const PROD_ORIGINS = new Set([SITE_ORIGIN, "https://www.takesuaci.com"]);
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

// 이 주소는 앱 밖으로 넘기는 링크가 되므로 요청 헤더를 그대로 믿지 않고 허용 목록만 쓴다.
// Amplify(CloudFront) 뒤에서는 x-forwarded-*가 원래 주소를 갖고 있다. 로컬 주소는 개발에서만
function requestOrigin(h: RequestHeaders): string {
  const forwardedProto = h.get("x-forwarded-proto")?.split(",")[0].trim();
  const hosts = [h.get("x-forwarded-host")?.split(",")[0].trim(), h.get("host")];
  for (const host of hosts) {
    if (!host) continue;
    const isLocal = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
    const proto =
      forwardedProto === "http" || forwardedProto === "https"
        ? forwardedProto
        : isLocal
          ? "http"
          : "https";
    const origin = `${proto}://${host}`;
    if (PROD_ORIGINS.has(origin)) return origin;
    if (process.env.NODE_ENV !== "production" && LOCAL_ORIGIN.test(origin)) return origin;
  }
  return SITE_ORIGIN;
}

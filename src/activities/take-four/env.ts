/** 카메라가 안 열리는 앱 안 브라우저. */
export type InAppBrowser = "instagram" | "kakao" | "facebook" | "line" | "naver";

export interface DeviceEnv {
  inApp: InAppBrowser | null;
  os: "ios" | "android" | "other";
}

// 인스타그램 UA에도 FBAN이 섞일 때가 있어 인스타를 먼저 본다
const IN_APP_PATTERNS: [InAppBrowser, RegExp][] = [
  ["instagram", /Instagram/i],
  ["kakao", /KAKAOTALK/i],
  ["facebook", /FBAN|FBAV|FB_IAB|FBIOS/],
  ["line", /\bLine\/\d/],
  ["naver", /NAVER\(inapp/i],
];

const PHONE_OR_TABLET = /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|Opera Mini|IEMobile/i;

/** UA로 인앱 브라우저와 OS를 가린다. */
export function detectEnv(ua: string): DeviceEnv {
  const inApp = IN_APP_PATTERNS.find(([, pattern]) => pattern.test(ua))?.[0] ?? null;
  const os = /iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : "other";
  return { inApp, os };
}

/**
 * 폰·태블릿 표시가 없는 UA면 PC로 본다(서버에서 정해 깜빡임 없이 PC 안내를 그린다).
 * UA가 비면 막지 않는 쪽(폰)으로 둔다. 데스크톱 UA를 보내는 아이패드도 PC 안내를 받는다 — 폰 전용 부스라 맞다.
 */
export function isDesktopUa(ua: string): boolean {
  return ua !== "" && !PHONE_OR_TABLET.test(ua);
}

/** 안드로이드 인앱에서 같은 주소를 크롬으로 연다. 미리보기 토큰이 따라가도록 쿼리를 남긴다. */
export function androidIntentUrl(url: string): string {
  const { protocol, host, pathname, search } = new URL(url);
  const scheme = protocol.slice(0, -1);
  return `intent://${host}${pathname}${search}#Intent;scheme=${scheme};package=com.android.chrome;end`;
}

/** 카카오톡 인앱에서 같은 주소를 기본 브라우저로 연다. */
export function kakaoExternalUrl(url: string): string {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
}

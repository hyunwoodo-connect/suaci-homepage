/**
 * 테스터 잠금 — 공개 전 이벤트를 숫자 비번 뒤에 둔다.
 * 비번(SITE_LOCK_PIN)은 Amplify 환경 변수 — 저장소가 공개라 코드에 두지 않는다. 맞히면 쿠키로 30일 열어 둔다.
 * 비번이 설정 안 됐으면 아무도 못 들어간다(잘못 열리는 쪽보다 낫다).
 */
export const SITE_LOCK_COOKIE = "suaci_preview";
export const SITE_LOCK_MAX_AGE_S = 60 * 60 * 24 * 30;

/** 쿠키에 넣는 값. 비번 자체는 쿠키에 두지 않는다 */
export async function lockToken(pin: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`suaci-site-lock:${pin}`),
  );
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 잠금 쿠키가 지금 비번으로 만든 값인가 */
export async function isUnlocked(cookie: string | undefined, pin: string | undefined) {
  if (!pin || !cookie) return false;
  return cookie === (await lockToken(pin));
}

/**
 * 들어간 뒤 돌아갈 곳. 같은 사이트 경로만 — `//evil.com`·`/\\evil.com`(브라우저가 `//` 로 읽음)·제어 문자(CR·LF 가
 * location 헤더에 들어가면 500)가 든 값은 `/`
 */
export function safeNext(next: unknown): string {
  return typeof next === "string" &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !/[\\\u0000-\u001f\u007f]/.test(next)
    ? next
    : "/";
}

/** 잠금 화면 언어. 사이트 로케일과 같다 */
export type GateLocale = "ko" | "en" | "ja";

const GATE_LOCALES: readonly GateLocale[] = ["ko", "en", "ja"];

/**
 * 잠금 화면 문구. i18n·레이아웃을 거치지 않는 단독 HTML이라 여기 둔다(브랜드 톤: 영어는 소문자).
 */
const GATE_COPY = {
  ko: {
    title: "suaci — 출시 준비 중",
    heading: "아직 열리지 않은 페이지예요.",
    body: "열리면 홈에서 먼저 보여 드릴게요.",
    home: "홈으로",
    tester: "테스터 입장",
    code: "테스터 코드",
    enter: "들어가기",
    wrong: "코드가 맞지 않아요.",
  },
  en: {
    title: "suaci — coming soon",
    heading: "this page isn't open yet.",
    body: "we'll show it on the home page first.",
    home: "home",
    tester: "tester entry",
    code: "tester code",
    enter: "enter",
    wrong: "wrong code.",
  },
  ja: {
    title: "suaci — 発売準備中",
    heading: "このページはまだ公開前です。",
    body: "公開したら、まずホームでお知らせします。",
    home: "ホームへ",
    tester: "テスター入口",
    code: "テスターコード",
    enter: "入る",
    wrong: "コードが違います。",
  },
} as const;

const GATE_FONTS: Record<GateLocale, string> = {
  ko: "family=Geist:wght@400;500;600&family=Noto+Sans+KR:wght@400;500",
  en: "family=Geist:wght@400;500;600",
  ja: "family=Geist:wght@400;500;600&family=Zen+Kaku+Gothic+New:wght@400;500",
};

/**
 * 잠금 화면 언어 고르기 — 주소의 언어 접두사(/en·/ja·/ko) > 사이트가 기억한 언어(NEXT_LOCALE 쿠키) >
 * 브라우저 언어(Accept-Language, q 순) > 한국어. 접두사 없는 주소가 한국어 사이트라 기본은 ko
 */
export function gateLocale(
  pathname: string,
  hints: { cookie?: string | null; acceptLanguage?: string | null } = {},
): GateLocale {
  const prefix = /^\/(en|ja|ko)(?:\/|$)/.exec(pathname)?.[1];
  if (prefix) return prefix as GateLocale;
  if (isGateLocale(hints.cookie)) return hints.cookie;
  const ranked = (hints.acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { lang: tag.split("-")[0], q: Number.isFinite(q) ? q : 0 };
    })
    .filter((x) => x.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.map((x) => x.lang).find(isGateLocale) ?? "ko";
}

/**
 * 잠금 화면 — 손님용 안내(아직 안 열렸다 + 홈으로)가 주인공, 테스터 비번은 접힌 칸 하나.
 * 비번 폼은 /api/site-lock 으로 POST(동작은 그대로). 틀리면 칸을 연 채로 안내
 */
export function gateHtml({
  next,
  wrong,
  locale,
}: {
  next: string;
  wrong: boolean;
  locale: GateLocale;
}): string {
  const c = GATE_COPY[locale];
  const home = locale === "ko" ? "/" : `/${locale}`;
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${c.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${GATE_FONTS[locale]}&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  html,body{margin:0;min-height:100%;background:#fff;color:#141414}
  body{display:flex;min-height:100dvh;padding:24px 16px;font-family:Geist,"Noto Sans KR","Zen Kaku Gothic New","Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased;word-break:keep-all}
  main{width:100%;max-width:360px;margin:auto;display:flex;flex-direction:column}
  .logo{height:20px;width:auto;align-self:flex-start;margin-bottom:40px}
  h1{margin:0;font-size:24px;line-height:1.35;font-weight:500;letter-spacing:-0.02em}
  h1 .dot{display:inline-block;width:8px;height:8px;margin-left:6px;border-radius:50%;background:#a9ff39;vertical-align:middle}
  .body{margin:12px 0 0;color:#5f5f5c;font-size:15px;line-height:1.7}
  .btn{display:flex;align-items:center;justify-content:center;height:52px;margin-top:28px;border-radius:999px;background:#141414;color:#fff;font-size:15px;font-weight:500;text-decoration:none}
  details{margin-top:48px;border-top:1px solid #e4e5e8;padding-top:16px}
  summary{cursor:pointer;color:#5f5f5c;font-size:13px;width:max-content}
  form{display:flex;flex-direction:column;gap:10px;margin-top:16px}
  label{color:#5f5f5c;font-size:12px}
  input[name=pin]{width:100%;height:48px;border:1px solid #e4e5e8;padding:0 12px;font:inherit;font-size:16px;letter-spacing:0.3em;color:#141414;outline:none}
  input[name=pin]:focus{border-color:#141414}
  button{height:48px;border:1px solid #e4e5e8;border-radius:999px;background:#fff;color:#141414;font:inherit;font-size:14px;cursor:pointer}
  a:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid #141414;outline-offset:2px}
  .err{margin:0;color:#b42318;font-size:13px}
</style>
</head>
<body>
<main>
  <img class="logo" src="/brand/logo-black.svg" alt="suaci" width="80" height="20">
  <h1>${c.heading}<span class="dot" aria-hidden="true"></span></h1>
  <p class="body">${c.body}</p>
  <a class="btn" href="${home}">${c.home}</a>
  <details${wrong ? " open" : ""}>
    <summary>${c.tester}</summary>
    <form method="post" action="/api/site-lock">
      <input type="hidden" name="next" value="${escapeAttr(next)}">
      <label for="pin">${c.code}</label>
      <input id="pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4"
        autocomplete="off" required${wrong ? ' autofocus aria-invalid="true" aria-describedby="err"' : ""}>
      ${wrong ? `<p id="err" class="err" role="alert">${c.wrong}</p>` : ""}
      <button type="submit">${c.enter}</button>
    </form>
  </details>
</main>
</body>
</html>`;
}

/** 잠금 화면 응답 — 401, 검색·캐시 제외 */
export function gateResponse(next: string, wrong: boolean, locale: GateLocale): Response {
  return new Response(gateHtml({ next, wrong, locale }), {
    status: 401,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

/* ─── 내부 ─────────────────────────── */

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isGateLocale(value: unknown): value is GateLocale {
  return typeof value === "string" && (GATE_LOCALES as readonly string[]).includes(value);
}

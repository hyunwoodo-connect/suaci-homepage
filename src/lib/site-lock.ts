/**
 * 출시 전 잠금. 숫자 비번(SITE_LOCK_PIN, Amplify 환경 변수 — 저장소가 공개라 코드에 두지 않는다)을
 * 넣으면 쿠키로 30일 열어 둔다. 비번이 설정 안 됐으면 아무도 못 들어간다(잘못 열리는 쪽보다 낫다).
 * 출시 때는 middleware에서 이 잠금 한 줄을 빼면 된다.
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

export async function isUnlocked(cookie: string | undefined, pin: string | undefined) {
  if (!pin || !cookie) return false;
  return cookie === (await lockToken(pin));
}

/** 들어간 뒤 돌아갈 곳. 같은 사이트 경로만(//evil.com 같은 건 /) */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * 잠금 화면. i18n·레이아웃을 거치지 않는 단독 HTML이라 문구는 여기 둔다(브랜드 톤: 소문자 영어)
 */
export function gateHtml({ next, wrong }: { next: string; wrong: boolean }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>suaci</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;background:#fff;color:#111}
  body{display:grid;place-items:center;padding:24px;font-family:Geist,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
  main{width:100%;max-width:320px;display:flex;flex-direction:column;align-items:center;gap:28px;text-align:center}
  .mark{font-size:32px;font-weight:600;letter-spacing:-0.03em;display:flex;align-items:center;gap:8px}
  .dot{width:8px;height:8px;border-radius:50%;background:#738136}
  p{margin:0;color:#5f5f5c;font-size:15px}
  form{width:100%;display:flex;flex-direction:column;gap:12px}
  input{width:100%;height:56px;border:1px solid #e4e5e8;border-radius:12px;text-align:center;font:inherit;font-size:24px;letter-spacing:0.5em;padding-left:0.5em;color:#111;outline:none}
  input:focus{border-color:#111}
  button{height:52px;border:0;border-radius:12px;background:#111;color:#fff;font:inherit;font-size:15px;font-weight:500;cursor:pointer}
  .err{color:#b42318;font-size:14px}
</style>
</head>
<body>
<main>
  <div class="mark"><span class="dot" aria-hidden="true"></span>suaci</div>
  <p>not open yet.</p>
  <form method="post" action="/api/site-lock">
    <input type="hidden" name="next" value="${escapeAttr(next)}">
    <input name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4"
      autocomplete="off" autofocus required aria-label="code"${wrong ? ' aria-invalid="true" aria-describedby="err"' : ""}>
    ${wrong ? '<p id="err" class="err" role="alert">wrong code.</p>' : ""}
    <button type="submit">enter</button>
  </form>
</main>
</body>
</html>`;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function gateResponse(next: string, wrong: boolean): Response {
  return new Response(gateHtml({ next, wrong }), {
    status: 401,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

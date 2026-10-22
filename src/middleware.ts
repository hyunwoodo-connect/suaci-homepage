import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import {
  checkEventAccess,
  eventSlugFromPath,
  previewCookieName,
  validPreviewToken,
} from "./lib/event-access";
import { SITE_LOCK_COOKIE, gateResponse, isUnlocked } from "./lib/site-lock";

const intl = createMiddleware(routing);

const EVENT_PREVIEW_MAX_AGE_S = 7 * 24 * 60 * 60;

export default async function middleware(req: NextRequest) {
  // 이벤트 페이지(/events/{slug})만 출시 전 잠금에서 뺀다 — 공개 이벤트이거나 미리보기 토큰이 맞을 때.
  // [locale] 밖이라 next-intl을 태우지 않는다(언어 접두사가 붙으면 안 된다).
  const slug = eventSlugFromPath(req.nextUrl.pathname);
  if (slug) {
    const cookieName = previewCookieName(slug);
    const queryToken = validPreviewToken(req.nextUrl.searchParams.get("preview"));
    const cookieToken = validPreviewToken(req.cookies.get(cookieName)?.value);

    // 공개 이벤트면 토큰 없이 통과(쿠키도 심지 않는다). 아니면 쿼리 토큰, 그다음 쿠키 토큰.
    let granted: { ok: boolean; token?: string } = {
      ok: await checkEventAccess(slug, undefined),
    };
    for (const token of [queryToken, cookieToken]) {
      if (granted.ok || !token) continue;
      if (await checkEventAccess(slug, token)) granted = { ok: true, token };
    }

    if (granted.ok) {
      const res = NextResponse.next();
      res.headers.set("Referrer-Policy", "same-origin"); // 토큰이 Referer로 새지 않게
      if (granted.token && granted.token === queryToken) {
        res.cookies.set(cookieName, granted.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: `/events/${slug}`,
          maxAge: EVENT_PREVIEW_MAX_AGE_S,
        });
      }
      return res;
    }
    // 못 열면 아래 기존 잠금으로 떨어진다
  }

  // TODO(출시): 출시 전 잠금 — 출시 때 이 블록을 지운다
  if (!(await isUnlocked(req.cookies.get(SITE_LOCK_COOKIE)?.value, process.env.SITE_LOCK_PIN))) {
    return gateResponse(req.nextUrl.pathname + req.nextUrl.search, false);
  }
  return intl(req);
}

export const config = {
  // `/api`·`/_next`·`/_vercel`로 시작하는 경로와 점이 든 경로(`favicon.ico` 같은 파일)는 빼고 모두
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

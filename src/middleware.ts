/**
 * 모든 페이지 요청의 입구. 이벤트 페이지(/events/{slug})는 공개 여부·미리보기 토큰으로 열고,
 * 그 밖은 next-intl 로 언어를 붙인다.
 */
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import {
  checkEventAccess,
  eventSlugFromPath,
  previewCookieName,
  validPreviewToken,
} from "./lib/event-access";
import { SITE_LOCK_COOKIE, gateLocale, gateResponse, isUnlocked } from "./lib/site-lock";

const intl = createMiddleware(routing);

const EVENT_PREVIEW_MAX_AGE_S = 7 * 24 * 60 * 60;

export default async function middleware(req: NextRequest) {
  // 이벤트 페이지는 공개 이벤트이거나 미리보기 토큰이 맞으면 연다. 아니면 사이트 비번(테스터)으로만.
  // [locale] 밖이라 next-intl을 태우지 않는다(언어 접두사가 붙으면 안 된다).
  const slug = eventSlugFromPath(req.nextUrl.pathname);
  if (slug) {
    const cookieName = previewCookieName(slug);
    const previewParam = req.nextUrl.searchParams.get("preview");
    const previewCookie = req.cookies.get(cookieName)?.value;
    const queryToken = validPreviewToken(previewParam);
    const cookieToken = validPreviewToken(previewCookie);

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
    // 공개 전 이벤트는 비번(테스터)으로만 연다
    const lockCookie = req.cookies.get(SITE_LOCK_COOKIE)?.value;
    const isSiteUnlocked = await isUnlocked(lockCookie, process.env.SITE_LOCK_PIN);
    if (!isSiteUnlocked) {
      return gate(req);
    }
    return NextResponse.next();
  }

  return intl(req);
}

/** 잠금 화면 — 손님 언어로(주소 접두사 > 기억한 언어 > 브라우저 언어) */
function gate(req: NextRequest): Response {
  const locale = gateLocale(req.nextUrl.pathname, {
    cookie: req.cookies.get("NEXT_LOCALE")?.value,
    acceptLanguage: req.headers.get("accept-language"),
  });
  const returnPath = req.nextUrl.pathname + req.nextUrl.search;
  return gateResponse(returnPath, false, locale);
}

export const config = {
  // `/api`·`/_next`·`/_vercel`로 시작하는 경로와 점이 든 경로(`favicon.ico` 같은 파일)는 빼고 모두
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

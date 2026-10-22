import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { checkEventAccess, eventSlugFromPath } from "./lib/event-access";
import { SITE_LOCK_COOKIE, gateResponse, isUnlocked } from "./lib/site-lock";

const intl = createMiddleware(routing);

const EVENT_PREVIEW_MAX_AGE_S = 7 * 24 * 60 * 60;

export default async function middleware(req: NextRequest) {
  // 이벤트 페이지(/events/{slug})만 출시 전 잠금에서 뺀다 — 공개 이벤트이거나 미리보기 토큰이 맞을 때.
  // [locale] 밖이라 next-intl을 태우지 않는다(언어 접두사가 붙으면 안 된다).
  const slug = eventSlugFromPath(req.nextUrl.pathname);
  if (slug) {
    const cookieName = `suaci_evt_${slug}`;
    const queryToken = req.nextUrl.searchParams.get("preview") || undefined;
    const token = queryToken ?? req.cookies.get(cookieName)?.value;
    if (await checkEventAccess(slug, token)) {
      const res = NextResponse.next();
      if (queryToken) {
        res.cookies.set(cookieName, queryToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: EVENT_PREVIEW_MAX_AGE_S,
        });
      }
      return res;
    }
    // 못 열면 아래 기존 잠금으로 떨어진다
  }

  // 출시 전 잠금 — 출시 때 이 블록을 지운다
  if (!(await isUnlocked(req.cookies.get(SITE_LOCK_COOKIE)?.value, process.env.SITE_LOCK_PIN))) {
    return gateResponse(req.nextUrl.pathname + req.nextUrl.search, false);
  }
  return intl(req);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

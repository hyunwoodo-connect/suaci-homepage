import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { SITE_LOCK_COOKIE, gateResponse, isUnlocked } from "./lib/site-lock";

const intl = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
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

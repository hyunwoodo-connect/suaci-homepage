/** 잠금 화면 비번 폼이 보내는 곳. 맞으면 잠금 쿠키를 심고 원래 가던 곳으로 */
import { NextResponse } from "next/server";

import {
  SITE_LOCK_COOKIE,
  SITE_LOCK_MAX_AGE_S,
  gateLocale,
  gateResponse,
  lockToken,
  safeNext,
} from "@/lib/site-lock";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const nextField = form?.get("next");
  const next = safeNext(nextField);
  const pin = process.env.SITE_LOCK_PIN;
  const tried = form?.get("pin");

  if (!pin || typeof tried !== "string" || tried !== pin) {
    // 하나씩 맞혀 보기 어렵게 틀리면 잠깐 늦춘다
    await new Promise((r) => setTimeout(r, 800));
    const cookieHeader = req.headers.get("cookie") ?? "";
    const localeCookie = /(?:^|;\s*)NEXT_LOCALE=([^;]+)/.exec(cookieHeader)?.[1];
    const locale = gateLocale(next, {
      cookie: localeCookie,
      acceptLanguage: req.headers.get("accept-language"),
    });
    return gateResponse(next, true, locale);
  }

  // Amplify 안에서 req.url은 내부 주소(localhost:3000)라 상대 경로로 보낸다
  const res = new NextResponse(null, { status: 303, headers: { location: next } });
  const unlockToken = await lockToken(pin);
  res.cookies.set(SITE_LOCK_COOKIE, unlockToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SITE_LOCK_MAX_AGE_S,
  });
  return res;
}

import { NextResponse } from "next/server";

import {
  SITE_LOCK_COOKIE,
  SITE_LOCK_MAX_AGE_S,
  gateResponse,
  lockToken,
  safeNext,
} from "@/lib/site-lock";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const next = safeNext(form?.get("next"));
  const pin = process.env.SITE_LOCK_PIN;
  const tried = form?.get("pin");

  if (!pin || typeof tried !== "string" || tried !== pin) {
    // 하나씩 맞혀 보기 어렵게 틀리면 잠깐 늦춘다
    await new Promise((r) => setTimeout(r, 800));
    return gateResponse(next, true);
  }

  // Amplify 안에서 req.url은 내부 주소(localhost:3000)라 상대 경로로 보낸다
  const res = new NextResponse(null, { status: 303, headers: { location: next } });
  res.cookies.set(SITE_LOCK_COOKIE, await lockToken(pin), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SITE_LOCK_MAX_AGE_S,
  });
  return res;
}

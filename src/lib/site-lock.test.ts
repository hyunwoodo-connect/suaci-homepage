import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

import middleware from "@/middleware";
import { POST } from "@/app/api/site-lock/route";

import {
  SITE_LOCK_COOKIE,
  gateHtml,
  gateLocale,
  isLockedBeforeLaunch,
  isUnlocked,
  lockToken,
  safeNext,
} from "./site-lock";

// next-intl 미들웨어는 vitest에서 못 읽으므로, 통과하면 200을 돌려주는 것으로 바꾼다
vi.mock("next-intl/middleware", () => ({
  default: () => () => new Response(null, { status: 200 }),
}));

afterEach(() => vi.unstubAllEnvs());

const post = (body: Record<string, string>) =>
  POST(
    new Request("https://takesuaci.com/api/site-lock", {
      method: "POST",
      // jsdom의 URLSearchParams는 fetch Request가 폼으로 못 읽어서 글자로 넘긴다
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    }),
  );

describe("site-lock", () => {
  it("쿠키는 비번 자체가 아니고, 맞는 비번의 값일 때만 열린다", async () => {
    const token = await lockToken("1234");
    expect(token).not.toContain("1234");
    expect(await isUnlocked(token, "1234")).toBe(true);
    expect(await isUnlocked(token, "0000")).toBe(false);
    expect(await isUnlocked(undefined, "1234")).toBe(false);
  });

  it("비번이 설정 안 됐으면 아무 쿠키로도 안 열린다", async () => {
    expect(await isUnlocked(await lockToken(""), undefined)).toBe(false);
    expect(await isUnlocked(await lockToken(""), "")).toBe(false);
  });

  it("safeNext: 같은 사이트 경로만", () => {
    expect(safeNext("/ja?x=1")).toBe("/ja?x=1");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });

  it("잠금 화면: 검색에 안 잡히고, 돌아갈 곳을 이스케이프한다", () => {
    const html = gateHtml({ next: '/"><script>', wrong: true, locale: "en" });
    expect(html).toContain('content="noindex, nofollow"');
    expect(html).not.toContain("<script>");
    expect(html).toContain("wrong code.");
    expect(gateHtml({ next: "/", wrong: false, locale: "en" })).not.toContain("wrong code.");
  });

  it("잠금 화면(주문): 손님 안내가 먼저 — 출시 때 열린다 + 출시 알림·홈, 비번 칸은 접혀 있다", () => {
    const html = gateHtml({ next: "/orders", wrong: false, locale: "ko" });
    expect(html).toContain('<html lang="ko">');
    expect(html).toContain("주문은 출시하는 날 열려요.");
    expect(html).toContain('href="/notify"');
    expect(html).toContain('href="/"');
    expect(html).toMatch(/<details>\s*<summary>테스터 입장<\/summary>/);
  });

  it("잠금 화면: 비번이 틀리면 테스터 칸을 연 채로 안내", () => {
    const html = gateHtml({ next: "/ja/checkout", wrong: true, locale: "ja" });
    expect(html).toContain("<details open>");
    expect(html).toContain("コードが違います。");
    expect(html).toContain('href="/ja/notify"');
  });

  it("잠금 화면(이벤트 등 그 밖): 주문 문구·출시 알림 없이 홈으로", () => {
    const html = gateHtml({ next: "/events/secret", wrong: false, locale: "ko" });
    expect(html).toContain("아직 열리지 않은 페이지예요.");
    expect(html).not.toContain("/notify");
  });

  it("gateLocale: 주소 접두사 > NEXT_LOCALE 쿠키 > Accept-Language(q 순) > ko", () => {
    expect(gateLocale("/en/orders", { cookie: "ja" })).toBe("en");
    expect(gateLocale("/ko/checkout", { acceptLanguage: "en-US" })).toBe("ko");
    expect(gateLocale("/orders", { cookie: "ja", acceptLanguage: "en" })).toBe("ja");
    expect(gateLocale("/orders", { acceptLanguage: "fr-FR,en;q=0.8,ko;q=0.9" })).toBe("ko");
    expect(gateLocale("/orders", { acceptLanguage: "ja-JP,ja;q=0.9" })).toBe("ja");
    expect(gateLocale("/orders", { acceptLanguage: "fr" })).toBe("ko");
    expect(gateLocale("/events/x")).toBe("ko");
  });

  it("middleware: 주문·결제 화면은 쿠키 없으면 잠금 화면(401), 맞는 쿠키면 통과", async () => {
    vi.stubEnv("SITE_LOCK_PIN", "1234");
    const locked = await middleware(new NextRequest("https://takesuaci.com/ja/checkout"));
    expect(locked.status).toBe(401);
    const body = await locked.text();
    expect(body).toContain('name="next" value="/ja/checkout"');
    expect(body).toContain('<html lang="ja">');

    const req = new NextRequest("https://takesuaci.com/ja/checkout");
    req.cookies.set(SITE_LOCK_COOKIE, await lockToken("1234"));
    expect((await middleware(req)).status).toBe(200);
  });

  it("middleware: 홈·정책·로그인·가입·계정은 쿠키 없이 열린다(카카오·PG 심사)", async () => {
    vi.stubEnv("SITE_LOCK_PIN", "1234");
    for (const path of [
      "/",
      "/ja",
      "/legal/terms",
      "/en/legal/business",
      "/login",
      "/signup",
      "/auth/consent",
      "/account",
    ]) {
      expect((await middleware(new NextRequest(`https://takesuaci.com${path}`))).status).toBe(200);
    }
  });

  it("POST: 맞으면 쿠키 + 원래 경로로, 틀리면 다시 잠금 화면", async () => {
    vi.stubEnv("SITE_LOCK_PIN", "1234");
    const ok = await post({ pin: "1234", next: "/ja" });
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe("/ja");
    expect(ok.headers.get("set-cookie")).toContain(
      `${SITE_LOCK_COOKIE}=${await lockToken("1234")}`,
    );

    const bad = await post({ pin: "0000", next: "/ja" });
    expect(bad.status).toBe(401);
    expect(bad.headers.get("set-cookie")).toBeNull();
  });

  it("POST: 비번이 설정 안 됐으면 빈 값으로도 못 연다", async () => {
    vi.stubEnv("SITE_LOCK_PIN", "");
    expect((await post({ pin: "", next: "/" })).status).toBe(401);
  });

  it("출시 알림 받기(/notify)는 언어 접두사 있든 없든 쿠키 없이 열린다", async () => {
    vi.stubEnv("SITE_LOCK_PIN", "1234");
    for (const path of ["/notify", "/ko/notify", "/ja/notify", "/en/notify"]) {
      expect((await middleware(new NextRequest(`https://takesuaci.com${path}`))).status).toBe(200);
    }
  });

  it("isLockedBeforeLaunch: 주문·결제·주문 내역만(하위 경로·언어 접두사 포함)", () => {
    for (const path of [
      "/checkout",
      "/ko/checkout",
      "/pay/complete",
      "/en/pay/fail",
      "/orders",
      "/orders/o_1",
      "/ja/orders/",
    ]) {
      expect(isLockedBeforeLaunch(path)).toBe(true);
    }
    for (const path of [
      "/",
      "/notify",
      "/login",
      "/signup",
      "/legal/refund",
      "/account",
      "/checkoutx",
      "/fr/checkout",
      "/payment",
    ]) {
      expect(isLockedBeforeLaunch(path)).toBe(false);
    }
  });
});

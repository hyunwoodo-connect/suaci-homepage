import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

import middleware from "@/middleware";
import { eventsApi } from "@/lib/api/events";
import { SITE_LOCK_COOKIE, lockToken } from "@/lib/site-lock";
import { checkEventAccess, eventSlugFromPath } from "@/lib/event-access";

vi.mock("next-intl/middleware", () => ({
  default: () => () => new Response(null, { status: 200 }),
}));
vi.mock("@/lib/api/events", () => ({ eventsApi: { get: vi.fn() } }));

const get = vi.mocked(eventsApi.get);
const detail = { slug: "x" } as never;
const url = (p: string) => `https://takesuaci.com${p}`;

beforeEach(() => {
  vi.stubEnv("SITE_LOCK_PIN", "1234");
  get.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("eventSlugFromPath", () => {
  it("/events/{slug}와 그 아래만 slug를 준다", () => {
    expect(eventSlugFromPath("/events/take-four")).toBe("take-four");
    expect(eventSlugFromPath("/events/take-four/result")).toBe("take-four");
    expect(eventSlugFromPath("/events")).toBeNull();
    expect(eventSlugFromPath("/events/")).toBeNull();
    expect(eventSlugFromPath("/en/events")).toBeNull();
    expect(eventSlugFromPath("/ja/events/take-four")).toBeNull();
    expect(eventSlugFromPath("/events/A_b")).toBeNull();
    expect(eventSlugFromPath("/events/a")).toBeNull();
  });
});

describe("checkEventAccess", () => {
  it("30초 동안 기억하고, 지나면 다시 묻는다", async () => {
    vi.useFakeTimers();
    try {
      get.mockResolvedValue(detail);
      expect(await checkEventAccess("cache-test", undefined)).toBe(true);
      expect(await checkEventAccess("cache-test", undefined)).toBe(true);
      expect(get).toHaveBeenCalledTimes(1);
      get.mockResolvedValue(null);
      vi.advanceTimersByTime(31_000);
      expect(await checkEventAccess("cache-test", undefined)).toBe(false);
      expect(get).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("백엔드가 터지면 false", async () => {
    get.mockRejectedValue(new Error("boom"));
    expect(await checkEventAccess("boom-evt", undefined)).toBe(false);
  });
});

describe("middleware: 이벤트 경로", () => {
  it("공개 이벤트는 잠금 쿠키 없이 통과하고 쿠키는 안 심는다", async () => {
    get.mockResolvedValue(detail);
    const res = await middleware(new NextRequest(url("/events/pub-evt")));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("숨김 이벤트는 잠금 화면", async () => {
    get.mockResolvedValue(null);
    expect((await middleware(new NextRequest(url("/events/hid-evt")))).status).toBe(401);
  });

  it("맞는 preview 토큰이면 통과 + 쿠키 설정", async () => {
    get.mockImplementation(async (_s, p) => (p === "good-tok" ? detail : null));
    const res = await middleware(new NextRequest(url("/events/prev-evt?preview=good-tok")));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("suaci_evt_prev-evt=good-tok");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).toContain("Max-Age=604800");
  });

  it("틀린(또는 폐기된) 토큰이면 잠금 화면, 쿠키 없음", async () => {
    get.mockResolvedValue(null);
    const res = await middleware(new NextRequest(url("/events/rot-evt?preview=old-tok")));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("쿠키만 있어도 하위 경로를 통과하고 쿠키를 다시 심지 않는다", async () => {
    get.mockImplementation(async (_s, p) => (p === "cook-tok" ? detail : null));
    const req = new NextRequest(url("/events/cook-evt/result"));
    req.cookies.set("suaci_evt_cook-evt", "cook-tok");
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("middleware: 그 밖의 경로", () => {
  it.each(["/events", "/en/events", "/ja/events"])("%s(목록)는 잠금 그대로", async (p) => {
    get.mockResolvedValue(detail);
    expect((await middleware(new NextRequest(url(p)))).status).toBe(401);
    expect(get).not.toHaveBeenCalled();

    const req = new NextRequest(url(p));
    req.cookies.set(SITE_LOCK_COOKIE, await lockToken("1234"));
    expect((await middleware(req)).status).toBe(200);
  });
});

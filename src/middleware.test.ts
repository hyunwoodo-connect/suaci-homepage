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

  it("캐시는 500개를 넘지 않는다", async () => {
    get.mockResolvedValue(detail);
    for (let i = 0; i < 520; i++) await checkEventAccess(`bound-${i}`, undefined);
    expect(get).toHaveBeenCalledTimes(520);
    // 비운 뒤라 앞쪽 항목은 다시 물어본다
    await checkEventAccess("bound-0", undefined);
    expect(get).toHaveBeenCalledTimes(521);
    await checkEventAccess("bound-519", undefined);
    expect(get).toHaveBeenCalledTimes(521);
  });

  it("3초 넘으면 false, 실패는 5초만 기억한다", async () => {
    vi.useFakeTimers();
    try {
      get.mockImplementation(() => new Promise(() => {}));
      const p = checkEventAccess("slow-evt", undefined);
      await vi.advanceTimersByTimeAsync(3_001);
      expect(await p).toBe(false);
      get.mockResolvedValue(detail);
      await vi.advanceTimersByTimeAsync(5_001);
      expect(await checkEventAccess("slow-evt", undefined)).toBe(true);
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
    get.mockImplementation(async (_s, p) => (p === "good-token-1234567" ? detail : null));
    const res = await middleware(
      new NextRequest(url("/events/prev-evt?preview=good-token-1234567")),
    );
    expect(res.headers.get("x-middleware-next")).toBe("1");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("suaci_evt_prev-evt=good-token-1234567");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).toContain("Max-Age=604800");
    expect(cookie).toContain("Path=/events/prev-evt");
    expect(res.headers.get("referrer-policy")).toBe("same-origin");
  });

  it("틀린(또는 폐기된) 토큰이면 잠금 화면, 쿠키 없음", async () => {
    get.mockResolvedValue(null);
    const res = await middleware(
      new NextRequest(url("/events/rot-evt?preview=old-token-12345678")),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("쿠키만 있어도 하위 경로를 통과하고 쿠키를 다시 심지 않는다", async () => {
    get.mockImplementation(async (_s, p) => (p === "cook-token-1234567" ? detail : null));
    const req = new NextRequest(url("/events/cook-evt/result"));
    req.cookies.set("suaci_evt_cook-evt", "cook-token-1234567");
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("쿼리 토큰이 낡았어도 쿠키가 맞으면 통과(쿠키는 안 바꾼다)", async () => {
    get.mockImplementation(async (_s, p) => (p === "cook-token-1234567" ? detail : null));
    const req = new NextRequest(url("/events/stale-evt?preview=stale-token-1234567"));
    req.cookies.set("suaci_evt_stale-evt", "cook-token-1234567");
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("공개 이벤트에 엉터리 preview가 붙어도 쿠키가 되지 않는다", async () => {
    get.mockResolvedValue(detail);
    const res = await middleware(
      new NextRequest(url("/events/junk-evt?preview=junk-token-1234567")),
    );
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("모양이 틀린 토큰은 백엔드를 부르지 않고(공개 확인만), 비공개면 잠금", async () => {
    get.mockResolvedValue(null);
    const res = await middleware(new NextRequest(url("/events/shape-evt?preview=short")));
    expect(res.status).toBe(401);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("shape-evt", undefined);
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

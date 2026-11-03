import { afterEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { SOCIAL_PROVIDERS } from "@/types";

import {
  SOCIAL_PROVIDER_CONFIG,
  authorizeUrl,
  clearSignupStash,
  createLoginState,
  envSocialMode,
  isSocialProvider,
  readLastProvider,
  readSignupStash,
  rememberLastProvider,
  safeNextPath,
  safeRedirectTarget,
  socialMode,
  socialRedirectUri,
  stashSignup,
  takeLoginState,
} from "./social";

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllEnvs();
});

describe("isSocialProvider", () => {
  it("받는 프로바이더 이름만 true", () => {
    for (const p of SOCIAL_PROVIDERS) expect(isSocialProvider(p)).toBe(true);
  });
  it("모르는 이름·대문자·빈 값·문자열 아님 → false", () => {
    for (const v of ["google", "KAKAO", "", null, undefined, 1]) {
      expect(isSocialProvider(v)).toBe(false);
    }
  });
});

describe("SOCIAL_PROVIDER_CONFIG", () => {
  it("프로바이더마다 https 인가 주소·버튼 색이 있다", () => {
    for (const p of SOCIAL_PROVIDERS) {
      const config = SOCIAL_PROVIDER_CONFIG[p];
      expect(config.authorizeBase, p).toMatch(/^https:\/\//);
      expect(config.colors.bg, p).toMatch(/^#[0-9a-f]{6}$/i);
      expect(config.colors.fg, p).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it("프로바이더마다 버튼 문구가 있다(ko — en·ja 는 messages.test 가 키를 맞춘다), 동의 취소 안내는 한 문장", () => {
    const login = ko.pay.login as Record<string, unknown>;
    for (const p of SOCIAL_PROVIDERS) {
      expect(typeof login[p], p).toBe("string");
    }
    // 켜진 다른 로그인이 환경마다 달라서 특정 프로바이더를 권하지 않는다
    expect(ko.pay.login.declined).not.toMatch(/카카오|네이버/);
  });
  it("클라 ID 는 프로바이더별 환경변수에서 — 카카오만 있으면 카카오만 live", () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "http");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_KAKAO_CLIENT_ID", "k-123");
    vi.stubEnv("NEXT_PUBLIC_NAVER_CLIENT_ID", "");
    expect(SOCIAL_PROVIDER_CONFIG.kakao.readClientId()).toBe("k-123");
    expect(envSocialMode("kakao")).toBe("live");
    expect(envSocialMode("naver")).toBe("off");
  });
});

describe("rememberLastProvider / readLastProvider", () => {
  it("기억한 프로바이더를 돌려준다", () => {
    rememberLastProvider("naver");
    expect(readLastProvider()).toBe("naver");
  });
  it("없거나 모르는 값이 저장돼 있으면 null", () => {
    expect(readLastProvider()).toBeNull();
    localStorage.setItem("suaci.auth.lastProvider", "google");
    expect(readLastProvider()).toBeNull();
  });
});

describe("socialMode", () => {
  it("클라ID + 실서버(http)면 live, 없으면 데모(mock 모드)거나 개발일 때만 mock, 운영+http 는 off", () => {
    expect(socialMode({ clientId: "k-123", apiMode: "http", nodeEnv: "production" })).toBe("live");
    // 목업 API 는 실제 카카오 코드를 바꿀 수 없다 — 클라 ID 가 있어도 목업 동의 화면
    expect(socialMode({ clientId: "k-123", apiMode: "mock", nodeEnv: "production" })).toBe("mock");
    expect(socialMode({ apiMode: "mock", nodeEnv: "production" })).toBe("mock");
    expect(socialMode({ apiMode: "http", nodeEnv: "development" })).toBe("mock");
    expect(socialMode({ apiMode: "http", nodeEnv: "production" })).toBe("off");
  });
});

describe("createLoginState / takeLoginState", () => {
  it("nonce 왕복 — 돌아올 곳을 담고, 한 번 읽으면 사라진다", () => {
    const nonce = createLoginState("/?buy=1");
    expect(takeLoginState(nonce)).toEqual({ next: "/?buy=1" });
    expect(takeLoginState(nonce)).toBeNull();
  });
  it("다른 nonce·없음 → null (위조 state 는 통과 못 한다)", () => {
    createLoginState("/");
    expect(takeLoginState("forged")).toBeNull();
    expect(takeLoginState(null)).toBeNull();
  });
});

describe("authorizeUrl / socialRedirectUri", () => {
  const redirectUri = "https://takesuaci.com/auth/kakao/callback";
  it("live: 카카오·네이버 인가 주소", () => {
    expect(
      authorizeUrl({ provider: "kakao", mode: "live", clientId: "k1", redirectUri, state: "s1" }),
    ).toBe(
      `https://kauth.kakao.com/oauth/authorize?client_id=k1&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=s1`,
    );
    expect(
      authorizeUrl({ provider: "naver", mode: "live", clientId: "n1", redirectUri, state: "s1" }),
    ).toBe(
      `https://nid.naver.com/oauth2.0/authorize?client_id=n1&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=s1`,
    );
  });
  it("mock: 앱 안 목업 동의 화면, off: null", () => {
    expect(authorizeUrl({ provider: "kakao", mode: "mock", redirectUri, state: "s1" })).toBe(
      `/auth/mock/kakao?redirect_uri=${encodeURIComponent(redirectUri)}&state=s1`,
    );
    expect(authorizeUrl({ provider: "naver", mode: "off", redirectUri, state: "s1" })).toBeNull();
  });
  it("redirectUri 는 기본 언어 경로(접두사 없음) 고정 — 프로바이더에 등록할 주소", () => {
    expect(socialRedirectUri("https://takesuaci.com", "naver")).toBe(
      "https://takesuaci.com/auth/naver/callback",
    );
  });
});

describe("safeNextPath / safeRedirectTarget — 오픈 리다이렉트 차단", () => {
  it("next 는 같은 사이트 경로만 — //evil.com·절대 URL 은 /", () => {
    expect(safeNextPath("/?buy=1")).toBe("/?buy=1");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
  it("목업 동의의 redirect_uri 는 같은 오리진(또는 상대 경로)만, 아니면 null", () => {
    const origin = "https://takesuaci.com";
    expect(safeRedirectTarget("https://takesuaci.com/auth/kakao/callback", origin)).toBe(
      "https://takesuaci.com/auth/kakao/callback",
    );
    expect(safeRedirectTarget("/auth/kakao/callback", origin)).toBe("/auth/kakao/callback");
    expect(safeRedirectTarget("https://evil.com/cb", origin)).toBeNull();
    expect(safeRedirectTarget("//evil.com/cb", origin)).toBeNull();
    expect(safeRedirectTarget("https://takesuaci.com.evil.com/cb", origin)).toBeNull();
  });
});

describe("stashSignup / readSignupStash / clearSignupStash", () => {
  afterEach(() => sessionStorage.clear());
  it("담은 가입 표를 그대로 꺼내고, 지우면 null", () => {
    stashSignup({ signupToken: "t1", provider: "kakao", name: "미나", next: "/?buy=1" });
    expect(readSignupStash()).toEqual({
      signupToken: "t1",
      provider: "kakao",
      name: "미나",
      next: "/?buy=1",
    });
    clearSignupStash();
    expect(readSignupStash()).toBeNull();
  });
  it("옛 키 그대로 읽는다(배포 전에 담긴 표도 이어서 쓴다)", () => {
    sessionStorage.setItem(
      "suaci.auth.signup",
      JSON.stringify({ signupToken: "t2", provider: "naver", next: "/" }),
    );
    expect(readSignupStash()).toEqual({ signupToken: "t2", provider: "naver", next: "/" });
  });
  it.each([
    ["깨진 JSON", "{"],
    ["모르는 프로바이더", JSON.stringify({ signupToken: "t", provider: "google", next: "/" })],
    ["표 번호 없음", JSON.stringify({ provider: "kakao", next: "/" })],
    ["객체가 아님", JSON.stringify("x")],
  ])("%s → null", (_label, raw) => {
    sessionStorage.setItem("suaci.auth.signup", raw);
    expect(readSignupStash()).toBeNull();
  });
});

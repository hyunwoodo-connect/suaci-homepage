import { afterEach, describe, expect, it } from "vitest";

import {
  authorizeUrl,
  createLoginState,
  socialMode,
  socialRedirectUri,
  takeLoginState,
} from "./social";

afterEach(() => sessionStorage.clear());

describe("socialMode", () => {
  it("클라ID 있으면 live, 없으면 데모(mock 모드)거나 개발일 때만 mock, 운영+http 는 off", () => {
    expect(socialMode({ clientId: "k-123", apiMode: "http", nodeEnv: "production" })).toBe("live");
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

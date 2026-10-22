import { describe, it, expect } from "vitest";

import { androidIntentUrl, detectEnv, isDesktopUa, kakaoExternalUrl } from "./env";

const UA = {
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  iosInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.31.94 (iPhone15,2; iOS 18_0; ko_KR; ko; scale=3.00; 1179x2556; 642359032)",
  androidInstagram:
    "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 Instagram 350.0.0.42.86 Android (34/14; 480dpi; 1080x2340; samsung; SM-S921N; e1q; qcom; ko_KR; 642359032)",
  iosKakao:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.5",
  androidKakao:
    "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36;KAKAOTALK 2410940",
  iosFacebook:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/485.0.0.40.104;FBBV/123;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.0;FBSS/3;FBLC/ko_KR]",
  androidLine:
    "Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 Line/14.17.1",
  iosNaver:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 NAVER(inapp; search; 2000; 12.8.2; 15PRO)",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
} as const;

describe("detectEnv", () => {
  it.each([
    ["iosInstagram", "instagram", "ios"],
    ["androidInstagram", "instagram", "android"],
    ["iosKakao", "kakao", "ios"],
    ["androidKakao", "kakao", "android"],
    ["iosFacebook", "facebook", "ios"],
    ["androidLine", "line", "android"],
    ["iosNaver", "naver", "ios"],
  ] as const)("%s → inApp %s, os %s", (key, inApp, os) => {
    expect(detectEnv(UA[key])).toEqual({ inApp, os });
  });

  it("아이폰 사파리 → 인앱 아님, ios", () => {
    expect(detectEnv(UA.iosSafari)).toEqual({ inApp: null, os: "ios" });
  });

  it("안드로이드 크롬 → 인앱 아님, android(Linux를 라인으로 잘못 보지 않는다)", () => {
    expect(detectEnv(UA.androidChrome)).toEqual({ inApp: null, os: "android" });
  });

  it("PC 크롬 → 인앱 아님, other", () => {
    expect(detectEnv(UA.macChrome)).toEqual({ inApp: null, os: "other" });
  });
});

describe("isDesktopUa", () => {
  it("맥 크롬·윈도 엣지 → PC", () => {
    expect(isDesktopUa(UA.macChrome)).toBe(true);
    expect(isDesktopUa(UA.windowsEdge)).toBe(true);
  });

  it("폰 브라우저·인앱 → PC 아님", () => {
    expect(isDesktopUa(UA.iosSafari)).toBe(false);
    expect(isDesktopUa(UA.androidChrome)).toBe(false);
    expect(isDesktopUa(UA.androidInstagram)).toBe(false);
  });

  it("UA가 비면 막지 않는다(PC 아님)", () => {
    expect(isDesktopUa("")).toBe(false);
  });
});

describe("androidIntentUrl", () => {
  it("같은 호스트·경로·쿼리를 크롬 intent로", () => {
    expect(androidIntentUrl("https://takesuaci.com/events/take-four?preview=abc#x")).toBe(
      "intent://takesuaci.com/events/take-four?preview=abc#Intent;scheme=https;package=com.android.chrome;end",
    );
  });
});

describe("androidIntentUrl · 포트", () => {
  it("주소의 프로토콜·포트를 그대로 쓴다", () => {
    expect(androidIntentUrl("http://192.168.0.5:3000/events/take-four")).toBe(
      "intent://192.168.0.5:3000/events/take-four#Intent;scheme=http;package=com.android.chrome;end",
    );
  });
});

describe("kakaoExternalUrl", () => {
  it("주소를 인코딩해 카카오톡 외부 열기 스킴으로", () => {
    expect(kakaoExternalUrl("https://takesuaci.com/events/take-four?preview=a&b=1")).toBe(
      "kakaotalk://web/openExternal?url=https%3A%2F%2Ftakesuaci.com%2Fevents%2Ftake-four%3Fpreview%3Da%26b%3D1",
    );
  });
});

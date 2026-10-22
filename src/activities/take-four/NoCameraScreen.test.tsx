import { describe, it, expect, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";

import type { EventDetail } from "@/types";

import NoCameraScreen from "./NoCameraScreen";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_INSTAGRAM =
  "Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 Instagram 350.0.0.0";
const IPHONE_INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0";
const EVENT = { slug: "take-four" } as EventDetail;
const URL_WITH_TOKEN = "https://takesuaci.com/events/take-four?preview=cookie-token-1234567";

function open(userAgent: string) {
  render(<NoCameraScreen event={EVENT} userAgent={userAgent} url={URL_WITH_TOKEN} />);
}

afterEach(() => {
  cleanup();
});

describe("NoCameraScreen", () => {
  it("카메라 거절 → 막힘 안내, 주 행동 앨범, 보조 행동 부스로 다시", () => {
    open(IPHONE_SAFARI);
    expect(screen.getByRole("heading", { name: "카메라가 막혀 있어요" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "앨범에서 넉 장 고르기" })).toHaveAttribute(
      "href",
      "/events/take-four/album",
    );
    expect(screen.getByRole("link", { name: "허용했어요, 다시 열기" })).toHaveAttribute(
      "href",
      "/events/take-four/booth",
    );
  });

  it("인스타 UA → 서버 HTML부터 인앱 문구(깜빡임 없음)", () => {
    const html = renderToStaticMarkup(
      <NoCameraScreen event={EVENT} userAgent={ANDROID_INSTAGRAM} url={URL_WITH_TOKEN} />,
    );
    expect(html).toContain("여기선 카메라가 안 열려요");
    expect(html).not.toContain("카메라가 막혀 있어요");
  });

  it("안드로이드 인앱 → 크롬 intent로 입구, 쿠키로만 온 미리보기 토큰도 따라간다", () => {
    open(ANDROID_INSTAGRAM);
    expect(screen.getByRole("link", { name: "앨범에서 넉 장 고르기" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다른 브라우저로 열기" })).toHaveAttribute(
      "href",
      "intent://takesuaci.com/events/take-four?preview=cookie-token-1234567#Intent;scheme=https;package=com.android.chrome;end",
    );
  });

  it("넘길 방법이 없는 iOS 인앱 → 본문 안내만, 부스로 다시 열기는 없다", () => {
    open(IPHONE_INSTAGRAM);
    expect(screen.getByText(/오른쪽 위 ··· 를 누르고/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "다른 브라우저로 열기" })).toBeNull();
    expect(screen.queryByRole("link", { name: "허용했어요, 다시 열기" })).toBeNull();
  });
});

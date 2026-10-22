import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";

import NoCameraScreen from "./NoCameraScreen";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_INSTAGRAM =
  "Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 Instagram 350.0.0.0";
const IPHONE_INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0";

function withUa(ua: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NoCameraScreen", () => {
  it("카메라 거절 → 막힘 안내, 주 행동 앨범, 보조 행동 부스로 다시", () => {
    withUa(IPHONE_SAFARI);
    render(<NoCameraScreen slug="take-four" />);
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

  it("서버 그림(UA 모름) → 거절 문구", () => {
    expect(renderToString(<NoCameraScreen slug="take-four" />)).toContain("카메라가 막혀 있어요");
  });

  it("안드로이드 인앱 → 인앱 안내, 앨범 + 크롬으로 입구 열기", () => {
    withUa(ANDROID_INSTAGRAM);
    render(<NoCameraScreen slug="take-four" />);
    expect(screen.getByRole("heading", { name: "여기선 카메라가 안 열려요" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "앨범에서 넉 장 고르기" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다른 브라우저로 열기" })).toHaveAttribute(
      "href",
      "intent://localhost:3000/events/take-four#Intent;scheme=http;package=com.android.chrome;end",
    );
  });

  it("넘길 방법이 없는 iOS 인앱 → 본문 안내만, 부스로 다시 열기는 없다", () => {
    withUa(IPHONE_INSTAGRAM);
    render(<NoCameraScreen slug="take-four" />);
    expect(screen.getByText(/오른쪽 위 ··· 를 누르고/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "다른 브라우저로 열기" })).toBeNull();
    expect(screen.queryByRole("link", { name: "허용했어요, 다시 열기" })).toBeNull();
  });
});

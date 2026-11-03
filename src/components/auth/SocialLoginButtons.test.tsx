import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { takeLoginState } from "@/lib/auth/social";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

import SocialLoginButtons from "./SocialLoginButtons";

function renderButtons() {
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <SocialLoginButtons next="/?buy=1" />
    </NextIntlClientProvider>,
  );
}

describe("SocialLoginButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("카카오·네이버 버튼을 그린다", () => {
    renderButtons();
    expect(screen.getByRole("button", { name: "카카오로 계속" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "네이버로 계속" })).toBeTruthy();
  });

  it("클릭 → state 저장 + 목업 동의 화면으로 push (개발 환경은 mock 모드)", () => {
    renderButtons();
    fireEvent.click(screen.getByRole("button", { name: "카카오로 계속" }));
    expect(push).toHaveBeenCalledTimes(1);
    const url = (push.mock.calls[0] as string[])[0];
    expect(url).toMatch(/^\/auth\/mock\/kakao\?redirect_uri=/);
    const state = new URLSearchParams(url.split("?")[1]).get("state");
    expect(takeLoginState(state)).toEqual({ next: "/?buy=1" });
  });

  it("운영+실서버에서 클라 ID 가 있는 프로바이더만 → 그 버튼만(off 는 숨김)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "http");
    vi.stubEnv("NEXT_PUBLIC_KAKAO_CLIENT_ID", "k-123");
    vi.stubEnv("NEXT_PUBLIC_NAVER_CLIENT_ID", "");
    renderButtons();
    expect(screen.getByRole("button", { name: "카카오로 계속" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "네이버로 계속" })).toBeNull();
  });

  it("전부 off(운영+실서버+키 없음) → 버튼 없이 준비 중 한 줄", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "http");
    vi.stubEnv("NEXT_PUBLIC_KAKAO_CLIENT_ID", "");
    vi.stubEnv("NEXT_PUBLIC_NAVER_CLIENT_ID", "");
    renderButtons();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText("로그인을 준비 중이에요.")).toBeTruthy();
  });

  it("live 프로바이더 클릭 → 프로바이더 인가 주소로 전체 이동", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "http");
    vi.stubEnv("NEXT_PUBLIC_KAKAO_CLIENT_ID", "k-123");
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, origin: "https://takesuaci.com", assign });
    renderButtons();
    fireEvent.click(screen.getByRole("button", { name: "카카오로 계속" }));
    expect(push).not.toHaveBeenCalled();
    const url = new URL(assign.mock.calls[0][0] as string);
    expect(`${url.origin}${url.pathname}`).toBe("https://kauth.kakao.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("k-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://takesuaci.com/auth/kakao/callback");
  });
});

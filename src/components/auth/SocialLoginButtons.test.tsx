import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ApiClientError } from "@/lib/api/errors";

const { socialComplete, getMe, replace } = vi.hoisted(() => ({
  socialComplete: vi.fn(),
  getMe: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  api: { socialComplete, getMe, logout: vi.fn() },
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import ConsentForm from "./ConsentForm";

function renderForm() {
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <AuthProvider>
        <ConsentForm
          stash={{ signupToken: "t1", provider: "kakao", name: "mina", next: "/?buy=1" }}
        />
      </AuthProvider>
    </NextIntlClientProvider>,
  );
}

describe("ConsentForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("필수 셋을 안 채우면 제출하지 않고 안내", async () => {
    renderForm();
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "동의하고 계속" }).closest("form")!);
    });
    expect(socialComplete).not.toHaveBeenCalled();
    expect(screen.getByText("필수 동의 세 가지에 체크해 주세요.")).toBeTruthy();
  });

  it("필수 셋 체크 → socialComplete(이름·동의) 호출 + next 로", async () => {
    socialComplete.mockResolvedValue({
      idToken: "i",
      accessToken: "a",
      refreshToken: "r",
      expiresIn: 60,
    });
    getMe.mockResolvedValue({ userId: "u1" });
    renderForm();
    for (const label of [
      "이용약관 동의 (필수)",
      "개인정보 수집·이용 동의 (필수)",
      "만 14세 이상입니다 (필수)",
    ]) {
      fireEvent.click(screen.getByLabelText(label));
    }
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "동의하고 계속" }).closest("form")!);
    });
    expect(socialComplete).toHaveBeenCalledWith({
      signupToken: "t1",
      name: "mina",
      consents: { terms: true, privacy: true, age: true, marketing: false },
    });
    expect(replace).toHaveBeenCalledWith("/?buy=1");
    expect(localStorage.getItem("suaci.auth.lastProvider")).toBe("kakao");
  });

  it("가입 표 만료 → 만료 문구 + 로그인 링크", async () => {
    socialComplete.mockRejectedValue(new ApiClientError("SOCIAL_SIGNUP_EXPIRED", "만료", 401));
    renderForm();
    for (const label of [
      "이용약관 동의 (필수)",
      "개인정보 수집·이용 동의 (필수)",
      "만 14세 이상입니다 (필수)",
    ]) {
      fireEvent.click(screen.getByLabelText(label));
    }
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "동의하고 계속" }).closest("form")!);
    });
    expect(screen.getByText("가입 시간이 지났어요. 다시 로그인해 주세요.")).toBeTruthy();
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { AuthProvider } from "@/lib/auth/auth-context";

const { resetPassword, push } = vi.hoisted(() => ({ resetPassword: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { resetPassword, getMe: vi.fn(), logout: vi.fn() } };
});
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/password/reset",
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ email: "jiwoo@example.com" }),
}));

import ResetPasswordPage from "./page";

async function renderPage() {
  await act(async () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <AuthProvider>
          <ResetPasswordPage />
        </AuthProvider>
      </NextIntlClientProvider>,
    );
  });
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));
  });
}

describe("비밀번호 재설정", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("규칙 안내가 보이고, 새 비밀번호 확인이 다르면 → 안내, 요청은 안 간다", async () => {
    await renderPage();
    expect(screen.getByText("8자 이상 입력해 주세요.")).toBeTruthy();
    fill("인증 코드", "123456");
    fill("새 비밀번호", "abcd1234");
    fill("새 비밀번호 확인", "abcd12345");
    expect(screen.getByText("비밀번호가 일치하지 않아요.")).toBeTruthy();
    await submit();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("같고 8자 이상이면 → 바꾸고 로그인으로", async () => {
    resetPassword.mockResolvedValue({});
    await renderPage();
    fill("인증 코드", "123456");
    fill("새 비밀번호", "abcd1234");
    fill("새 비밀번호 확인", "abcd1234");
    await submit();
    expect(resetPassword).toHaveBeenCalledWith({
      email: "jiwoo@example.com",
      code: "123456",
      newPassword: "abcd1234",
    });
    expect(push).toHaveBeenCalledWith({ pathname: "/login", query: { reset: "1" } });
  });

  it("두 칸 모두 '비밀번호 보기' 단추", async () => {
    await renderPage();
    expect(screen.getAllByRole("button", { name: "비밀번호 보기" })).toHaveLength(2);
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { AuthProvider } from "@/lib/auth/auth-context";

vi.mock("@/lib/api", () => ({
  api: { login: vi.fn(), getMe: vi.fn(), logout: vi.fn() },
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/login",
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import LoginPage from "./page";

function renderPage() {
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </NextIntlClientProvider>,
  );
}

describe("로그인 페이지", () => {
  it("소셜 둘 + 안내 한 줄, google/apple/line 은 없다", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "카카오로 계속" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "네이버로 계속" })).toBeTruthy();
    expect(screen.getByText("주소랑 연락처는 알아서 채워 둘게요.")).toBeTruthy();
    expect(screen.queryByText(/google|apple|line/)).toBeNull();
  });

  it("이메일 폼은 접혀 있고 '이메일로 로그인'을 누르면 보인다", () => {
    renderPage();
    // InputField 는 label-for 연결이 없어 placeholder 로 찾는다
    expect(screen.queryByPlaceholderText("you@email.com")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "이메일로 로그인" }));
    expect(screen.getByPlaceholderText("you@email.com")).toBeTruthy();
    expect(screen.getByPlaceholderText("••••••••")).toBeTruthy();
  });
});

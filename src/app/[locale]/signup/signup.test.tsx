import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { AuthProvider } from "@/lib/auth/auth-context";
import { tokenStore } from "@/lib/auth/token-store";

const { signup, getMe } = vi.hoisted(() => ({ signup: vi.fn(), getMe: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { signup, confirm: vi.fn(), login: vi.fn(), getMe, logout: vi.fn() } };
});
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/signup",
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

import { ApiClientError } from "@/lib/api";

import SignupPage from "./page";

async function renderPage() {
  await act(async () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <AuthProvider>
          <SignupPage />
        </AuthProvider>
      </NextIntlClientProvider>,
    );
  });
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillForm(password: string, confirm: string) {
  fill("이름", "지우");
  fill("이메일", "jiwoo@example.com");
  fill("비밀번호", password);
  fill("비밀번호 확인", confirm);
  fireEvent.click(screen.getByLabelText("모두 동의"));
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "가입하기" }));
  });
}

describe("이메일 회원가입", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStore.clear();
  });

  it("비밀번호 규칙(8자 이상)은 쓰기 전부터 칸 아래에 보인다", async () => {
    await renderPage();
    expect(screen.getByText("8자 이상 입력해 주세요.")).toBeTruthy();
  });

  it("확인 칸이 다르면 → 쓰는 동안 칸 아래 '비밀번호가 일치하지 않아요.', 가입 요청은 안 간다", async () => {
    await renderPage();
    fillForm("abcd1234", "abcd1235");
    expect(screen.getByText("비밀번호가 일치하지 않아요.")).toBeTruthy();
    expect(screen.getByLabelText("비밀번호 확인").getAttribute("aria-invalid")).toBe("true");
    await submit();
    expect(signup).not.toHaveBeenCalled();
  });

  it("8자보다 짧으면 → 규칙 안내 대신 오류, 가입 요청은 안 간다", async () => {
    await renderPage();
    fillForm("abc123", "abc123");
    await submit();
    expect(screen.getByText("비밀번호를 8자 이상 입력해 주세요.")).toBeTruthy();
    expect(signup).not.toHaveBeenCalled();
  });

  it("두 칸이 같고 8자 이상이면 → 가입 요청", async () => {
    signup.mockResolvedValue({ email: "jiwoo@example.com" });
    await renderPage();
    fillForm("abcd1234", "abcd1234");
    await submit();
    expect(signup).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jiwoo@example.com", password: "abcd1234" }),
    );
  });

  it("서버가 비밀번호 규칙으로 거절하면 → 칸 아래 길이 안내", async () => {
    signup.mockRejectedValue(new ApiClientError("AUTH_WEAK_PASSWORD", "x", 400));
    await renderPage();
    fillForm("abcd1234", "abcd1234");
    await submit();
    expect(screen.getByText("비밀번호를 8자 이상 입력해 주세요.")).toBeTruthy();
  });

  it("두 비밀번호 칸 모두 '비밀번호 보기' 단추가 있다", async () => {
    await renderPage();
    expect(screen.getAllByRole("button", { name: "비밀번호 보기" })).toHaveLength(2);
  });
});

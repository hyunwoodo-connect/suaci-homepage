import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { ApiClientError } from "@/lib/api";
import { AuthProvider } from "@/lib/auth/auth-context";
import { tokenStore } from "@/lib/auth/token-store";
import { readSavedMemo, saveMemo } from "@/lib/checkout/memo";

const { getMe, listAddresses, withdrawAccount, replace } = vi.hoisted(() => ({
  getMe: vi.fn(),
  listAddresses: vi.fn(),
  withdrawAccount: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { getMe, listAddresses, logout: vi.fn(), withdrawAccount },
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/account",
  Link: ({
    href,
    children,
  }: {
    href: string | { pathname: string };
    children: React.ReactNode;
  }) => <a href={typeof href === "string" ? href : href.pathname}>{children}</a>,
}));

import AccountPage from "./page";

const USER = {
  userId: "u1",
  email: "",
  name: "지우",
  status: "active",
  createdAt: Date.UTC(2026, 10, 2, 16, 0), // KST 11/03 01:00
  createdDtm: "2026-11-03T01:00:00+09:00",
};

async function renderPage() {
  await act(async () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <AuthProvider>
          <AccountPage />
        </AuthProvider>
      </NextIntlClientProvider>,
    );
  });
}

describe("내 계정", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMe.mockReset();
    tokenStore.clear();
    listAddresses.mockResolvedValue([]);
  });

  it("로그인 → 인사·가입일(KST), 내부 상태값(ACTIVE)은 안 보인다", async () => {
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getMe.mockResolvedValue(USER);
    await renderPage();
    expect(screen.getByText("지우님, 반가워요.")).toBeTruthy();
    expect(screen.getByText("2026.11.03")).toBeTruthy();
    expect(screen.queryByText(/active/i)).toBeNull();
  });

  it("이메일이 비어 있으면(카카오가 안 줌) → 이메일 줄을 그리지 않는다", async () => {
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getMe.mockResolvedValue(USER);
    await renderPage();
    // 푸터 사업자 정보에도 '이메일'이 있어 계정 정보 목록 안에서만 본다
    const info = screen.getByText("가입일").closest("dl")!;
    expect(within(info as HTMLElement).queryByText("이메일")).toBeNull();
  });

  it("주문 내역 → /orders 링크(주문 화면은 출시 전에도 열려 있다)", async () => {
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getMe.mockResolvedValue(USER);
    await renderPage();
    expect(document.querySelector('a[href="/orders"]')).not.toBeNull();
  });

  it("배송지가 없으면 → 배송지 줄에 '아직 없어요'", async () => {
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getMe.mockResolvedValue(USER);
    await renderPage();
    await waitFor(() => expect(screen.getByText("아직 없어요")).toBeTruthy());
  });

  it("배송지 요약을 받다가 로그인이 풀리면 → '로그인이 풀렸어요' + 로그인 버튼", async () => {
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getMe.mockResolvedValueOnce(USER).mockRejectedValueOnce(new Error("AUTH_REQUIRED"));
    listAddresses.mockRejectedValueOnce(new ApiClientError("AUTH_REQUIRED", "Unauthorized", 401));
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText("로그인이 풀렸어요. 다시 들어와 주세요.")).toBeTruthy(),
    );
  });

  it("배송지 요약만 못 받은 그 밖의 실패 → 계정은 그대로, 배송지 줄은 이름만", async () => {
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getMe.mockResolvedValue(USER);
    listAddresses.mockRejectedValueOnce(new ApiClientError("SERVER_ERROR", "", 500));
    await renderPage();
    expect(screen.getByText("지우님, 반가워요.")).toBeTruthy();
    expect(screen.queryByText("아직 없어요")).toBeNull();
  });

  it("저장된 로그인이 풀렸으면 → '로그인이 풀렸어요' + 로그인 버튼", async () => {
    tokenStore.save({ idToken: "i", accessToken: "old", refreshToken: "r", expiresIn: 60 });
    getMe.mockRejectedValue(new Error("AUTH_REQUIRED"));
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText("로그인이 풀렸어요. 다시 들어와 주세요.")).toBeTruthy(),
    );
    expect(screen.getByRole("link", { name: "로그인 / 가입" })).toBeTruthy();
  });
});

describe("회원 탈퇴", () => {
  const TOKENS = { idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 };

  beforeEach(() => {
    vi.clearAllMocks();
    getMe.mockReset();
    withdrawAccount.mockReset();
    tokenStore.save(TOKENS);
    getMe.mockResolvedValue(USER);
    listAddresses.mockResolvedValue([]);
  });

  /** 계정 화면 맨 아래 '회원 탈퇴'를 눌러 확인 시트를 연다 */
  async function openSheet(): Promise<HTMLElement> {
    await renderPage();
    const link = await screen.findByRole("button", { name: "회원 탈퇴" });
    fireEvent.click(link);
    return screen.getByRole("dialog");
  }

  /** '안내를 확인했어요'를 체크하고 '탈퇴하기'를 누른다 */
  async function confirmAndSubmit(sheet: HTMLElement): Promise<void> {
    fireEvent.click(within(sheet).getByLabelText("안내를 확인했어요"));
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "탈퇴하기" }));
    });
  }

  it("'회원 탈퇴' → 바로 지우지 않고 확인 시트: 지우는 것·보관 기간이 보이고, 확인을 체크해야 '탈퇴하기'가 열린다", async () => {
    const sheet = await openSheet();
    expect(within(sheet).getByText("주문·결제·배송 기록 5년")).toBeTruthy();
    expect(within(sheet).getByText("취소·반품·교환 기록 3년")).toBeTruthy();
    expect(within(sheet).getByText("배송지")).toBeTruthy();
    const submit = within(sheet).getByRole("button", { name: "탈퇴하기" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(within(sheet).getByLabelText("안내를 확인했어요"));
    expect(submit.disabled).toBe(false);
    expect(withdrawAccount).not.toHaveBeenCalled();
  });

  it("닫기(X) → 시트가 닫히고 아무것도 보내지 않는다", async () => {
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(withdrawAccount).not.toHaveBeenCalled();
  });

  it("탈퇴하기 → 로그인·배송 메모를 비우고 홈(?withdrawn=1)으로, 로그인 안내는 비치지 않는다", async () => {
    withdrawAccount.mockResolvedValueOnce({ withdrawn: true });
    saveMemo("공동현관 1234");
    const sheet = await openSheet();
    await confirmAndSubmit(sheet);
    expect(withdrawAccount).toHaveBeenCalledWith({ leaveWaitlist: false });
    expect(tokenStore.getAccessToken()).toBeNull();
    expect(readSavedMemo()).toBeNull();
    expect(replace).toHaveBeenCalledWith({ pathname: "/", query: { withdrawn: "1" } });
    expect(screen.queryByText("로그인하면 배송지와 주문을 여기서 볼 수 있어요.")).toBeNull();
    // 홈으로 넘어갈 때까지 시트는 그대로(다시 누를 수 없다) — 먼저 사라지면 기록 칸을 걷는 뒤로가기가 홈으로 가는 길을 끊는다
    const submit = within(screen.getByRole("dialog")).getByRole("button", { name: "…" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it("'출시 알림도 그만 받을게요'를 체크하면 → leaveWaitlist: true 로 보낸다", async () => {
    withdrawAccount.mockResolvedValueOnce({ withdrawn: true });
    const sheet = await openSheet();
    fireEvent.click(within(sheet).getByLabelText("출시 알림도 그만 받을게요"));
    await confirmAndSubmit(sheet);
    expect(withdrawAccount).toHaveBeenCalledWith({ leaveWaitlist: true });
  });

  it("끝나지 않은 주문·신청이 있으면(409) → 진행 중 안내 + 주문 내역 링크, 로그인은 그대로", async () => {
    withdrawAccount.mockRejectedValueOnce(
      new ApiClientError("ACCOUNT_WITHDRAWAL_BLOCKED", "blocked", 409),
    );
    const sheet = await openSheet();
    await confirmAndSubmit(sheet);
    expect(within(sheet).getByRole("alert").textContent).toBe(
      "아직 진행 중인 주문이나 신청이 있어요. 끝난 뒤에 탈퇴할 수 있어요.",
    );
    const orders = within(sheet).getByRole("link", { name: "주문 내역 보기" });
    expect(orders.getAttribute("href")).toBe("/orders");
    expect(within(sheet).queryByRole("button", { name: "탈퇴하기" })).toBeNull();
    expect(tokenStore.getAccessToken()).toBe("a");
    expect(replace).not.toHaveBeenCalled();
  });

  it("그 밖의 실패 → 다시 시도 안내, 다시 누르면 다시 보내 끝낸다", async () => {
    withdrawAccount
      .mockRejectedValueOnce(new ApiClientError("SERVER_ERROR", "", 500))
      .mockResolvedValueOnce({ withdrawn: true });
    const sheet = await openSheet();
    await confirmAndSubmit(sheet);
    expect(within(sheet).getByRole("alert").textContent).toBe(
      "탈퇴를 마치지 못했어요. 잠시 후 다시 시도해 주세요.",
    );
    expect(tokenStore.getAccessToken()).toBe("a");
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "탈퇴하기" }));
    });
    expect(withdrawAccount).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledWith({ pathname: "/", query: { withdrawn: "1" } });
  });

  it("보내다 로그인이 풀리면(401) → 시트를 닫고 '로그인이 풀렸어요'", async () => {
    withdrawAccount.mockRejectedValueOnce(new ApiClientError("AUTH_REQUIRED", "Unauthorized", 401));
    const sheet = await openSheet();
    getMe.mockRejectedValue(new Error("AUTH_REQUIRED"));
    await confirmAndSubmit(sheet);
    await waitFor(() =>
      expect(screen.getByText("로그인이 풀렸어요. 다시 들어와 주세요.")).toBeTruthy(),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});

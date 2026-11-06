import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { ApiClientError } from "@/lib/api";
import { AuthProvider } from "@/lib/auth/auth-context";
import { tokenStore } from "@/lib/auth/token-store";

const { getMe, listAddresses, deleteAddress } = vi.hoisted(() => ({
  getMe: vi.fn(),
  listAddresses: vi.fn(),
  deleteAddress: vi.fn(),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { getMe, listAddresses, deleteAddress, logout: vi.fn() },
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/account/addresses",
  Link: ({
    href,
    children,
  }: {
    href: string | { pathname: string };
    children: React.ReactNode;
  }) => <a href={typeof href === "string" ? href : href.pathname}>{children}</a>,
}));

import AddressesPage from "./page";

const ADDRESS = {
  addressId: "a1",
  recipient: "지우",
  phone: "010-1234-5678",
  zipcode: "13529",
  addr1: "경기 성남시 분당구 판교역로 166",
  addr2: "101동",
  isDefault: true,
  createdAt: 0,
  createdDtm: "",
};

async function renderPage() {
  await act(async () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <AuthProvider>
          <AddressesPage />
        </AuthProvider>
      </NextIntlClientProvider>,
    );
  });
}

describe("배송지", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getMe.mockResolvedValue({ userId: "u1", name: "지우", email: "" });
  });

  it("없으면 → 안내 + '배송지 추가' 하나(큰 입력 폼부터 띄우지 않는다)", async () => {
    listAddresses.mockResolvedValue([]);
    await renderPage();
    expect(screen.getByText("아직 배송지가 없어요.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "배송지 추가" })).toBeTruthy();
    expect(screen.queryByLabelText("받는 분")).toBeNull();
  });

  it("배송지 이름이 있으면 그 이름이 제목, 받는 분은 아래 줄에", async () => {
    listAddresses.mockResolvedValue([{ ...ADDRESS, label: "회사" }]);
    await renderPage();
    expect(screen.getByRole("heading", { name: "회사" })).toBeTruthy();
    expect(screen.getByText("지우 · 010-1234-5678")).toBeTruthy();
  });

  it("배송지 이름이 없으면 → 받는 분 이름이 제목", async () => {
    listAddresses.mockResolvedValue([ADDRESS]);
    await renderPage();
    expect(screen.getByRole("heading", { name: "지우" })).toBeTruthy();
    expect(screen.getByText("010-1234-5678")).toBeTruthy();
  });

  it("'배송지 추가' → 배송지 이름(선택) 칸이 있다", async () => {
    listAddresses.mockResolvedValue([]);
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "배송지 추가" }));
    expect(screen.getByLabelText("배송지 이름 (선택)")).toBeTruthy();
  });

  it("삭제는 한 번 더 묻는다 — '그대로 두기'면 지우지 않는다", async () => {
    listAddresses.mockResolvedValue([ADDRESS]);
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.getByText("이 배송지를 지울까요?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "그대로 두기" }));
    expect(deleteAddress).not.toHaveBeenCalled();
  });

  it("'지우기'까지 누르면 → 지운다", async () => {
    listAddresses.mockResolvedValue([ADDRESS]);
    deleteAddress.mockResolvedValue(undefined);
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "지우기" }));
    });
    expect(deleteAddress).toHaveBeenCalledWith("a1");
  });

  it("지우기가 실패하면 → '저장하지 못했어요' 한 줄, 배송지는 그대로", async () => {
    listAddresses.mockResolvedValue([ADDRESS]);
    deleteAddress.mockRejectedValueOnce(new ApiClientError("SERVER_ERROR", "", 500));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "지우기" }));
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "저장하지 못했어요. 다시 한 번 눌러 주세요.",
    );
    expect(screen.getByRole("heading", { name: "지우" })).toBeTruthy();
  });

  it("지우다가 로그인이 풀리면(AUTH_REQUIRED) → '로그인이 풀렸어요' + 로그인 버튼", async () => {
    listAddresses.mockResolvedValue([ADDRESS]);
    deleteAddress.mockRejectedValueOnce(new ApiClientError("AUTH_REQUIRED", "", 401));
    await renderPage();
    getMe.mockRejectedValueOnce(new ApiClientError("AUTH_REQUIRED", "", 401));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "지우기" }));
    });
    expect(screen.getByText("로그인이 풀렸어요. 다시 들어와 주세요.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "로그인 / 가입" })).toBeTruthy();
  });
});

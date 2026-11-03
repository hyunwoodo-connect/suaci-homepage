import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { AuthProvider } from "@/lib/auth/auth-context";
import { tokenStore } from "@/lib/auth/token-store";

const { getMe, listAddresses, deleteAddress } = vi.hoisted(() => ({
  getMe: vi.fn(),
  listAddresses: vi.fn(),
  deleteAddress: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  api: { getMe, listAddresses, deleteAddress, logout: vi.fn() },
  ApiClientError: class extends Error {},
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
});

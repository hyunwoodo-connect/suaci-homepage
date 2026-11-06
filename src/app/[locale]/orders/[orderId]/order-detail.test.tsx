import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { AuthProvider } from "@/lib/auth/auth-context";
import { tokenStore } from "@/lib/auth/token-store";
import { ApiClientError } from "@/lib/api";

const { getMe, getOrder, listClaims, cancelOrder, createClaim, createReturn } = vi.hoisted(() => ({
  getMe: vi.fn(),
  getOrder: vi.fn(),
  listClaims: vi.fn(),
  cancelOrder: vi.fn(),
  createClaim: vi.fn(),
  createReturn: vi.fn(),
}));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: { getMe, getOrder, listClaims, cancelOrder, createClaim, createReturn, logout: vi.fn() },
  };
});
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/orders/o1",
  Link: ({
    href,
    children,
  }: {
    href: string | { pathname: string };
    children: React.ReactNode;
  }) => <a href={typeof href === "string" ? href : href.pathname}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

import type { Claim, Order } from "@/types";

import OrderDetailPage from "./page";

const ORDER: Order = {
  orderId: "o1",
  orderNo: "20261106-ABC123",
  status: "open",
  paymentStatus: "paid",
  fulfillmentStatus: "unfulfilled",
  totals: {
    itemsSubtotal: 28000,
    discountTotal: 0,
    shippingFee: 3000,
    taxTotal: 0,
    grandTotal: 31000,
  },
  shippingAddress: {
    recipient: "지우",
    phone: "010-1234-5678",
    zipcode: "13529",
    addr1: "판교역로 166",
  },
  items: [
    {
      lineId: "l1",
      productId: "p1",
      variantId: "v1",
      sku: "S",
      productName: "take-01",
      optionName: "100 ml",
      unitPrice: 28000,
      compareAtPrice: 28000,
      quantity: 1,
      lineSubtotal: 28000,
    },
  ],
  createdAt: 0,
  createdDtm: "",
};

function signIn() {
  tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
}

async function renderPage() {
  await act(async () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <AuthProvider>
          <OrderDetailPage params={Promise.resolve({ orderId: "o1" })} />
        </AuthProvider>
      </NextIntlClientProvider>,
    );
  });
}

describe("주문 상세", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listClaims.mockResolvedValue([]);
    getMe.mockResolvedValue({ userId: "u1", name: "지우", email: "" });
  });

  it("로그인 안 했으면 뼈대에 멈추지 않고 로그인 버튼", async () => {
    await renderPage();
    expect(await screen.findByText("로그인이 필요해요.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "로그인" }).getAttribute("href")).toBe("/login");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("주문을 못 불러오면 이유 + 다시 시도 + 주문 내역으로 돌아갈 길", async () => {
    signIn();
    getOrder.mockRejectedValue(new Error("boom"));
    await renderPage();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "주문 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
    );
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /주문 내역으로/ }).getAttribute("href")).toBe(
      "/orders",
    );
  });

  it("받는 중에는 → 뼈대만(주문·취소 내역을 같이 받아 한 번에 그린다)", async () => {
    signIn();
    getOrder.mockResolvedValue(ORDER);
    listClaims.mockReturnValue(new Promise(() => {}));
    await renderPage();
    expect(screen.getByRole("status", { name: "불러오는 중…" })).toBeTruthy();
    expect(screen.queryByText("take-01")).toBeNull();
  });

  it("결제했고 안 보냄 → 상태는 '결제완료' 하나, 세 갈래 칩은 없다", async () => {
    signIn();
    getOrder.mockResolvedValue(ORDER);
    await renderPage();
    expect(screen.getByText("결제완료")).toBeTruthy();
    expect(screen.queryByText("배송 전")).toBeNull();
    expect(screen.getByRole("heading", { name: "결제 정보" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "주문 관리" })).toBeTruthy();
  });

  it("결제 대기 → 30분 안에 결제하라는 한 줄", async () => {
    signIn();
    getOrder.mockResolvedValue({ ...ORDER, status: "pending", paymentStatus: "pending" });
    await renderPage();
    expect(screen.getByText("결제 대기")).toBeTruthy();
    expect(screen.getByText(/30분 안에 결제해 주세요/)).toBeTruthy();
  });

  it("결제 대기 주문 취소는 한 번 더 묻는다 — '돌아가기'면 취소하지 않는다", async () => {
    signIn();
    getOrder.mockResolvedValue({ ...ORDER, status: "pending", paymentStatus: "pending" });
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "주문 취소" }));
    expect(screen.getByRole("button", { name: "취소하기" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "돌아가기" }));
    expect(cancelOrder).not.toHaveBeenCalled();
  });

  it("취소 요청 → 사유 화면 이름은 바뀌어도 API 에는 원래 값(상품하자)이 간다", async () => {
    signIn();
    getOrder.mockResolvedValue(ORDER);
    createClaim.mockResolvedValue({});
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "주문 취소 요청" }));
    expect(screen.getByText("취소 사유 선택")).toBeTruthy();
    expect(screen.getByText(/3~7영업일이 더 걸릴 수 있어요/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "상품 불량(파손·누액 포함)" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "취소 요청하기" }));
    });
    expect(createClaim).toHaveBeenCalledWith(
      "o1",
      expect.objectContaining({ reasonCode: "상품하자", lines: undefined }),
    );
  });

  it("취소할 수 없는 주문(CLAIM_NOT_ALLOWED) → 고객센터 안내", async () => {
    signIn();
    getOrder.mockResolvedValue(ORDER);
    createClaim.mockRejectedValue(new ApiClientError("CLAIM_NOT_ALLOWED", "x", 409));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "주문 취소 요청" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "취소 요청하기" }));
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "이 주문은 지금 취소·반품을 신청할 수 없어요. 고객센터로 문의해 주세요.",
    );
  });

  it("결제 대기 취소가 막히면(ORDER_NOT_CANCELLABLE) → 그 이유, 모르는 실패면 다시 시도 안내", async () => {
    signIn();
    getOrder.mockResolvedValue({ ...ORDER, status: "pending", paymentStatus: "pending" });
    cancelOrder
      .mockRejectedValueOnce(new ApiClientError("ORDER_NOT_CANCELLABLE", "x", 409))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "주문 취소" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "취소하기" }));
    });
    expect(screen.getByRole("alert").textContent).toBe("이 주문은 취소할 수 없어요");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "취소하기" }));
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
    );
  });

  it("상품 준비 중(발송 전) → 아직 취소 요청할 수 있다", async () => {
    signIn();
    getOrder.mockResolvedValue({ ...ORDER, fulfillmentStatus: "preparing" });
    await renderPage();
    expect(screen.getByText("상품준비중")).toBeTruthy();
    expect(screen.getByRole("button", { name: "주문 취소 요청" })).toBeTruthy();
  });

  it("발송됨 → 택배사·송장번호와 배송 조회(새 탭), 취소 요청은 없다", async () => {
    signIn();
    getOrder.mockResolvedValue({
      ...ORDER,
      fulfillmentStatus: "shipped",
      carrier: "cj",
      trackingNumber: "123456789012",
      trackingUrl: "https://trace.cjlogistics.com/next/tracking.html?wblNo=123456789012",
    });
    await renderPage();
    expect(screen.getByText("CJ대한통운 123456789012")).toBeTruthy();
    const track = screen.getByRole("link", { name: "배송 조회" });
    expect(track.getAttribute("href")).toBe(
      "https://trace.cjlogistics.com/next/tracking.html?wblNo=123456789012",
    );
    expect(track.getAttribute("target")).toBe("_blank");
    expect(track.getAttribute("rel")).toContain("noopener");
    expect(screen.queryByRole("button", { name: "주문 취소 요청" })).toBeNull();
  });

  it("모르는 택배사 코드·조회 링크 없음 → 코드와 송장번호만, 버튼은 없다", async () => {
    signIn();
    getOrder.mockResolvedValue({
      ...ORDER,
      fulfillmentStatus: "delivered",
      carrier: "dhl",
      trackingNumber: "ZX99",
    });
    await renderPage();
    expect(screen.getByText("dhl ZX99")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "배송 조회" })).toBeNull();
  });

  describe("반품 신청", () => {
    const DAY = 24 * 60 * 60 * 1000;
    const delivered = (daysAgo: number): Order => ({
      ...ORDER,
      fulfillmentStatus: "delivered",
      carrier: "cj",
      trackingNumber: "123456789012",
      deliveredAt: Date.now() - daysAgo * DAY,
    });
    const returnClaim = (over: Partial<Claim>): Claim => ({
      claimId: "r1",
      orderId: "o1",
      type: "return",
      status: "requested",
      reasonCode: "단순변심",
      lines: [{ lineId: "l1", productId: "p1", variantId: "v1", quantity: 1 }],
      refundAmount: 25000,
      refundedShipping: 0,
      returnShippingFee: 3000,
      createdAt: Date.now(),
      createdDtm: "",
      ...over,
    });

    it("받은 지 이틀 → 단순 변심은 미개봉 확인 전엔 못 보내고, 반품 배송비를 뺀 예상 환불 금액을 보여 준 뒤 신청", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(2));
      createReturn.mockResolvedValue({});
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: "반품 신청" }));
      const quote = screen.getByRole("region", { name: "예상 환불 금액" });
      expect(quote.textContent).toContain("반품 배송비 (고객 부담)−₩3,000");
      expect(quote.textContent).toContain("환불 예정 금액₩25,000");
      const submit = screen.getByRole("button", { name: "반품 신청하기" });
      expect(submit).toHaveProperty("disabled", true);
      fireEvent.click(
        screen.getByRole("checkbox", { name: "밀봉을 뜯지 않았고 사용하지 않았어요" }),
      );
      await act(async () => {
        fireEvent.click(submit);
      });
      expect(createReturn).toHaveBeenCalledWith(
        "o1",
        expect.objectContaining({
          reasonCode: "단순변심",
          unopenedConfirmed: true,
          lines: undefined,
        }),
      );
    });

    it("상품 불량 → 미개봉 확인 없이, 처음 낸 배송비까지 돌려주는 금액", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(2));
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: "반품 신청" }));
      fireEvent.click(screen.getByRole("button", { name: "상품 불량(파손·누액 포함)" }));
      expect(screen.queryByRole("checkbox")).toBeNull();
      const quote = screen.getByRole("region", { name: "예상 환불 금액" });
      expect(quote.textContent).toContain("처음 낸 배송비 환불+₩3,000");
      expect(quote.textContent).toContain("환불 예정 금액₩31,000");
      expect(screen.getByRole("button", { name: "반품 신청하기" })).toHaveProperty(
        "disabled",
        false,
      );
    });

    it("받은 지 열흘 → 단순 변심은 고를 수 없고 하자 쪽으로 시작한다", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(10));
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: "반품 신청" }));
      expect(screen.getByRole("button", { name: "단순 변심" })).toHaveProperty("disabled", true);
      expect(
        screen
          .getByRole("button", { name: "상품 불량(파손·누액 포함)" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(screen.getByText(/단순 변심 반품은 받은 날부터 7일까지/)).toBeTruthy();
    });

    it("서버가 기한 지남으로 막으면 → 그 이유", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(2));
      createReturn.mockRejectedValue(new ApiClientError("RETURN_WINDOW_CLOSED", "x", 409));
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: "반품 신청" }));
      fireEvent.click(screen.getByRole("button", { name: "오배송" }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "반품 신청하기" }));
      });
      expect(screen.getByRole("alert").textContent).toBe(
        "반품 신청 기간이 지났어요. 고객센터로 문의해 주세요.",
      );
    });

    it("진행 중인 반품이 있으면 버튼 대신 내역에 '반품 신청됨'과 보낼 곳 안내", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(2));
      listClaims.mockResolvedValue([returnClaim({})]);
      await renderPage();
      expect(screen.queryByRole("button", { name: "반품 신청" })).toBeNull();
      expect(screen.getByText("반품 신청됨")).toBeTruthy();
      expect(screen.getByText("반품 배송비 ₩3,000 차감")).toBeTruthy();
      expect(screen.getByText(/보내실 곳과 방법을 메일로 안내해 드려요/)).toBeTruthy();
    });

    it("거절된 반품 → 거절 이유를 보여 주고 다시 신청할 수 있다", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(2));
      listClaims.mockResolvedValue([
        returnClaim({ status: "rejected", rejectReason: "사용한 흔적이 있어요" }),
      ]);
      await renderPage();
      expect(screen.getByText("반품 거절")).toBeTruthy();
      expect(screen.getByText("거절 이유: 사용한 흔적이 있어요")).toBeTruthy();
      expect(screen.getByRole("button", { name: "반품 신청" })).toBeTruthy();
    });
  });
});

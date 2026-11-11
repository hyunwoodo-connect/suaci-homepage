import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { AuthProvider } from "@/lib/auth/auth-context";
import { tokenStore } from "@/lib/auth/token-store";
import { ApiClientError } from "@/lib/api";

const {
  getMe,
  getOrder,
  listClaims,
  cancelOrder,
  createClaim,
  previewRefund,
  createReturn,
  createExchange,
  withdrawClaim,
  listAddresses,
  changeShippingAddress,
} = vi.hoisted(() => ({
  getMe: vi.fn(),
  getOrder: vi.fn(),
  listClaims: vi.fn(),
  cancelOrder: vi.fn(),
  createClaim: vi.fn(),
  previewRefund: vi.fn(),
  createReturn: vi.fn(),
  createExchange: vi.fn(),
  withdrawClaim: vi.fn(),
  listAddresses: vi.fn(),
  changeShippingAddress: vi.fn(),
}));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: {
      getMe,
      getOrder,
      listClaims,
      cancelOrder,
      createClaim,
      previewRefund,
      createReturn,
      createExchange,
      withdrawClaim,
      listAddresses,
      changeShippingAddress,
      logout: vi.fn(),
    },
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

import type { Claim, Order, OrderState, RefundPreview } from "@/types";

import OrderDetailPage from "./page";

const ORDER: Order = {
  orderId: "o1",
  orderNo: "20261106-ABC123",
  state: "paid",
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

/** 결제 대기 주문 */
const PENDING: Order = {
  ...ORDER,
  state: "awaitingPayment",
  status: "pending",
  paymentStatus: "pending",
};
/** 상품준비중(포장 시작) 주문 */
const PREPARING: Order = { ...ORDER, state: "preparing", fulfillmentStatus: "preparing" };
/** 배송중 주문 */
const SHIPPING: Order = { ...ORDER, state: "shipping", fulfillmentStatus: "shipped" };

/** 서버 미리 보기의 기본 답 — ORDER 를 다 돌려받을 때(상품 금액 + 처음 낸 배송비) */
const FULL_REFUND: RefundPreview = {
  itemsAmount: 28000,
  refundedShipping: 3000,
  returnShippingFee: 0,
  priorCompensation: 0,
  refundAmount: 31000,
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

/** 신청 버튼 — 환불 금액(서버 미리 보기)을 받아 풀릴 때까지 기다린다. 그 전에는 보낼 수 없다 */
async function readyButton(name: string): Promise<HTMLElement> {
  const button = screen.getByRole("button", { name });
  await waitFor(() => expect(button).toHaveProperty("disabled", false));
  return button;
}

/**
 * 취소 폼 보내기 — 사유를 아직 안 골랐으면 '단순 변심'을 고르고, '취소 요청하기' → 확인 '네, 취소할게요'.
 * 취소는 환불 금액을 보여 주고 한 번 더 묻는다(UX 리뷰 F2)
 */
async function sendCancel() {
  if (screen.queryByText("사유를 골라 주세요.")) {
    fireEvent.click(screen.getByRole("button", { name: "단순 변심" }));
  }
  const submit = await readyButton("취소 요청하기");
  fireEvent.click(submit);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "네, 취소할게요" }));
  });
}

/** 맨 위 상태 칩 — 진행 단계에도 같은 이름이 있어 단계 목록 밖의 것을 고른다 */
function stateBadge(name: string): HTMLElement {
  const badge = screen.getAllByText(name).find((el) => !el.closest("ol"));
  if (!badge) throw new Error(`상태 칩 '${name}' 없음`);
  return badge;
}

describe("주문 상세", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listClaims.mockResolvedValue([]);
    previewRefund.mockResolvedValue(FULL_REFUND);
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
    expect(stateBadge("결제완료")).toBeTruthy();
    expect(screen.queryByText("배송 전")).toBeNull();
    expect(screen.getByRole("heading", { name: "결제 정보" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "주문 관리" })).toBeTruthy();
  });

  it("발송기한이 지났는데 아직 안 보냄 → 발송 지연 안내 + 취소 요청 길", async () => {
    signIn();
    getOrder.mockResolvedValue({ ...ORDER, shipBy: Date.now() - 1000 });
    await renderPage();
    expect(screen.getByText(/발송이 늦어지고 있어요\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "주문 취소 요청" })).toBeTruthy();
  });

  it("기한은 지났지만 남은 수량이 모두 취소 중(버튼 없음) → '아래 취소 요청' 안내를 보이지 않는다", async () => {
    signIn();
    getOrder.mockResolvedValue({ ...ORDER, shipBy: Date.now() - 1000 });
    // 환불 처리 중(approved)인 전체 취소 — 남은 수량이 0이라 '주문 취소 요청' 버튼이 없다
    const cancelling: Claim = {
      claimId: "c1",
      orderId: "o1",
      type: "cancel",
      status: "refunding",
      reasonCode: "단순변심",
      lines: ORDER.items.map((i) => ({
        lineId: i.lineId,
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
      })),
      refundAmount: ORDER.totals.grandTotal,
      refundedShipping: 0,
      returnShippingFee: 0,
      photoCount: 0,
      createdAt: 0,
      createdDtm: "",
    };
    listClaims.mockResolvedValue([cancelling]);
    await renderPage();
    expect(stateBadge("결제완료")).toBeTruthy();
    expect(screen.queryByText(/발송이 늦어지고 있어요/)).toBeNull();
  });

  it("발송기한 전이거나 기한이 없으면(발송됨·테스트 결제) → 지연 안내 없음", async () => {
    signIn();
    getOrder.mockResolvedValue({ ...ORDER, shipBy: Date.now() + 60_000 });
    await renderPage();
    expect(stateBadge("결제완료")).toBeTruthy();
    expect(screen.queryByText(/발송이 늦어지고 있어요/)).toBeNull();
  });

  it("결제 대기 → 30분 안에 결제하라는 한 줄 + 남은 분 + '이 주문 결제하기'(주문서로, 수량 그대로)", async () => {
    signIn();
    const dueAt = Date.now() + 24 * 60_000;
    getOrder.mockResolvedValue({ ...PENDING, paymentDueAt: dueAt });
    await renderPage();
    expect(screen.getByText("결제 대기")).toBeTruthy();
    expect(screen.getByText(/30분 안에 결제해 주세요/)).toBeTruthy();
    expect(screen.getByText(/24분 남았어요/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "이 주문 결제하기" }).getAttribute("href")).toBe(
      `/checkout?qty=${String(ORDER.items[0].quantity)}`,
    );
    // 결제 대기엔 진행 단계가 없다
    expect(screen.queryByRole("list", { name: "진행 단계" })).toBeNull();
  });

  it("결제한 주문 → 진행 단계·결제수단·결제일시·영수증(새 탭), 할인 0원 줄은 없다", async () => {
    signIn();
    getOrder.mockResolvedValue({
      ...ORDER,
      state: "shipping",
      fulfillmentStatus: "shipped",
      paymentMethod: "간편결제(카카오페이)",
      paidAt: Date.parse("2026-11-09T15:05:00Z"),
      receiptUrl: "https://receipt.test/r1",
    });
    await renderPage();
    const steps = screen.getByRole("list", { name: "진행 단계" });
    expect(steps.querySelector('[aria-current="step"]')?.textContent).toBe("배송중");
    expect(screen.getByText("카카오페이")).toBeTruthy();
    expect(screen.getByText("2026.11.10 00:05")).toBeTruthy();
    const receipt = screen.getByRole("link", { name: "영수증 보기" });
    expect(receipt.getAttribute("href")).toBe("https://receipt.test/r1");
    expect(receipt.getAttribute("target")).toBe("_blank");
    expect(screen.queryByText("할인")).toBeNull();
  });

  it("받은 뒤 반품 진행 중 → 상태 칩은 '반품 진행 중'(배송완료 아님)", async () => {
    signIn();
    getOrder.mockResolvedValue({
      ...ORDER,
      state: "returnInProgress",
      fulfillmentStatus: "delivered",
      deliveredAt: Date.now(),
    });
    listClaims.mockResolvedValue([
      {
        claimId: "r1",
        orderId: "o1",
        type: "return",
        status: "requested",
        reasonCode: "상품하자",
        lines: [{ lineId: "l1", productId: "p1", variantId: "v1", quantity: 1 }],
        refundAmount: 31000,
        refundedShipping: 3000,
        returnShippingFee: 0,
        photoCount: 0,
        createdAt: 0,
        createdDtm: "",
      },
    ]);
    await renderPage();
    expect(screen.getByText("반품 진행 중")).toBeTruthy();
  });

  // 세 축 값은 그대로 두고 state 만 바꾼다 — 상세는 상태 이름을 서버 값에서만 읽는다
  it.each<[OrderState, string]>([
    ["awaitingPayment", "결제 대기"],
    ["paid", "결제완료"],
    ["preparing", "상품준비중"],
    ["shipping", "배송중"],
    ["delivered", "배송완료"],
    ["returnInProgress", "반품 진행 중"],
    ["exchangeInProgress", "교환 진행 중"],
    ["refunding", "환불 처리 중"],
    ["partiallyRefunded", "부분환불"],
    ["refunded", "환불완료"],
    ["cancelled", "주문취소"],
  ])("서버가 준 상태 %s → 맨 위 칩 '%s'", async (state, label) => {
    signIn();
    getOrder.mockResolvedValue({ ...ORDER, state });
    await renderPage();
    expect(stateBadge(label)).toBeTruthy();
  });

  it("끝난 취소 환불 → '환불 예정' 대신 카드사 반영 안내", async () => {
    signIn();
    getOrder.mockResolvedValue({
      ...ORDER,
      state: "refunded",
      paymentStatus: "refunded",
      status: "cancelled",
    });
    listClaims.mockResolvedValue([
      {
        claimId: "c1",
        orderId: "o1",
        type: "cancel",
        status: "refunded",
        reasonCode: "단순변심",
        lines: [{ lineId: "l1", productId: "p1", variantId: "v1", quantity: 1 }],
        refundAmount: 31000,
        refundedShipping: 3000,
        returnShippingFee: 0,
        photoCount: 0,
        refundDueAt: Date.parse("2026-11-12T14:59:59Z"),
        createdAt: 0,
        createdDtm: "",
      },
    ]);
    await renderPage();
    expect(screen.queryByText(/환불 예정/)).toBeNull();
    expect(screen.getByText("카드사에 따라 3~7영업일 뒤 반영돼요.")).toBeTruthy();
  });

  it("결제 대기 주문 취소는 한 번 더 묻는다 — '돌아가기'면 취소하지 않는다", async () => {
    signIn();
    getOrder.mockResolvedValue(PENDING);
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
    await sendCancel();
    expect(createClaim).toHaveBeenCalledWith(
      "o1",
      expect.objectContaining({ reasonCode: "상품하자", lines: undefined }),
    );
  });

  it("취소 요청이 실패한 뒤 다시 보내면 → 같은 멱등키(두 번 환불되지 않게)", async () => {
    signIn();
    getOrder.mockResolvedValue(ORDER);
    createClaim.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({});
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "주문 취소 요청" }));
    await sendCancel();
    await sendCancel();
    expect(createClaim).toHaveBeenCalledTimes(2);
    const [first, second] = createClaim.mock.calls.map(
      (c) => (c[1] as { idempotencyKey: string }).idempotencyKey,
    );
    expect(second).toBe(first);
  });

  describe("멱등키는 폼이 아니라 주문 상세에 — 닫았다 열어도 같은 키, 성공해야 새 키", () => {
    const keyOf = (call: unknown[]) => (call[1] as { idempotencyKey: string }).idempotencyKey;
    const cancelClaim: Claim = {
      claimId: "c-new",
      orderId: "o1",
      type: "cancel",
      status: "refunded",
      reasonCode: "단순변심",
      lines: [{ lineId: "l1", productId: "p1", variantId: "v1", quantity: 1 }],
      refundAmount: 28000,
      refundedShipping: 0,
      returnShippingFee: 0,
      photoCount: 0,
      createdAt: 0,
      createdDtm: "",
    };
    const TWO: Order = {
      ...ORDER,
      items: [{ ...ORDER.items[0], quantity: 2, lineSubtotal: 56000 }],
    };

    async function submitCancel() {
      fireEvent.click(screen.getByRole("button", { name: "주문 취소 요청" }));
      await sendCancel();
    }

    it("실패 뒤 폼을 닫고 다시 열어 보내도 → 같은 멱등키(응답만 늦었던 환불이 두 번 되지 않게)", async () => {
      signIn();
      getOrder.mockResolvedValue(TWO);
      createClaim.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({});
      await renderPage();
      await submitCancel();
      fireEvent.click(screen.getByRole("button", { name: "닫기" }));
      await submitCancel();
      expect(createClaim).toHaveBeenCalledTimes(2);
      expect(keyOf(createClaim.mock.calls[1])).toBe(keyOf(createClaim.mock.calls[0]));
    });

    it("실패하면 → 주문·클레임을 다시 읽는다", async () => {
      signIn();
      getOrder.mockResolvedValue(TWO);
      createClaim.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      await renderPage();
      await submitCancel();
      expect(getOrder).toHaveBeenCalledTimes(2);
      expect(listClaims).toHaveBeenCalledTimes(2);
    });

    it("성공한 뒤 새로 신청하면 → 새 멱등키", async () => {
      signIn();
      getOrder.mockResolvedValue(TWO);
      createClaim.mockResolvedValue({});
      await renderPage();
      await submitCancel();
      await submitCancel();
      expect(createClaim).toHaveBeenCalledTimes(2);
      expect(keyOf(createClaim.mock.calls[1])).not.toBe(keyOf(createClaim.mock.calls[0]));
    });

    it("실패로 보였지만 다시 읽으니 신청이 생겼으면 → 성공으로 보고 폼을 닫고, 다음 신청은 새 키", async () => {
      signIn();
      getOrder.mockResolvedValue({
        ...TWO,
        state: "partiallyRefunded",
        paymentStatus: "partially_refunded",
      });
      listClaims.mockResolvedValueOnce([]).mockResolvedValue([cancelClaim]);
      createClaim.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce({});
      await renderPage();
      await submitCancel();
      expect(screen.queryByRole("button", { name: "취소 요청하기" })).toBeNull();
      expect(screen.getByText("환불 완료")).toBeTruthy();
      await submitCancel();
      expect(keyOf(createClaim.mock.calls[1])).not.toBe(keyOf(createClaim.mock.calls[0]));
    });

    it("반품도 → 실패 뒤 닫았다 열어도 같은 키", async () => {
      signIn();
      getOrder.mockResolvedValue({
        ...TWO,
        state: "delivered",
        fulfillmentStatus: "delivered",
        deliveredAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
      });
      createReturn.mockRejectedValue(new TypeError("Failed to fetch"));
      await renderPage();
      for (let i = 0; i < 2; i++) {
        fireEvent.click(screen.getByRole("button", { name: "반품 신청" }));
        fireEvent.click(screen.getByRole("button", { name: "오배송" }));
        const submit = await readyButton("반품 신청하기");
        await act(async () => {
          fireEvent.click(submit);
        });
        fireEvent.click(screen.getByRole("button", { name: "닫기" }));
      }
      expect(createReturn).toHaveBeenCalledTimes(2);
      expect(keyOf(createReturn.mock.calls[1])).toBe(keyOf(createReturn.mock.calls[0]));
    });
  });

  it("취소 요청 → 서버가 준 환불 예정 금액을 보이고, 한 번 더 묻는다 — '돌아가기'면 보내지 않는다", async () => {
    signIn();
    getOrder.mockResolvedValue(ORDER);
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "주문 취소 요청" }));
    const quote = screen.getByRole("region", { name: "예상 환불 금액" });
    await waitFor(() => expect(quote.textContent).toContain("환불 예정 금액₩31,000"));
    // 금액을 받았어도 사유를 고르기 전엔 보낼 수 없다
    expect(screen.getByRole("button", { name: "취소 요청하기" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "단순 변심" }));
    const submit = await readyButton("취소 요청하기");
    expect(previewRefund).toHaveBeenLastCalledWith("o1", {
      type: "cancel",
      reasonCode: "단순변심",
    });
    fireEvent.click(submit);
    expect(screen.getByText("취소하면 ₩31,000을 환불해 드려요. 취소할까요?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "돌아가기" }));
    expect(createClaim).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "취소 요청하기" })).toBeTruthy();
  });

  it("취소 요청하기 연타 → 요청은 한 번", async () => {
    signIn();
    getOrder.mockResolvedValue(ORDER);
    createClaim.mockReturnValue(new Promise(() => {}));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "주문 취소 요청" }));
    fireEvent.click(screen.getByRole("button", { name: "단순 변심" }));
    const request = await readyButton("취소 요청하기");
    fireEvent.click(request);
    const submit = screen.getByRole("button", { name: "네, 취소할게요" });
    await act(async () => {
      fireEvent.click(submit);
      fireEvent.click(submit);
    });
    expect(createClaim).toHaveBeenCalledTimes(1);
  });

  describe("일부 취소 뒤", () => {
    const TWO: Order = {
      ...ORDER,
      state: "partiallyRefunded",
      paymentStatus: "partially_refunded",
      items: [{ ...ORDER.items[0], quantity: 2, lineSubtotal: 56000 }],
    };
    const cancelled = (status: Claim["status"], quantity: number): Claim => ({
      claimId: `c-${status}`,
      orderId: "o1",
      type: "cancel",
      status,
      reasonCode: "단순변심",
      lines: [{ lineId: "l1", productId: "p1", variantId: "v1", quantity }],
      refundAmount: 28000 * quantity,
      refundedShipping: 0,
      returnShippingFee: 0,
      photoCount: 0,
      createdAt: 0,
      createdDtm: "",
    });

    it("이미 취소된 1개를 빼고 남은 1개까지만 고른다", async () => {
      signIn();
      getOrder.mockResolvedValue(TWO);
      listClaims.mockResolvedValue([cancelled("refunded", 1)]);
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: "주문 취소 요청" }));
      fireEvent.click(screen.getByRole("button", { name: "일부 취소" }));
      expect(screen.getByText(/남은 수량 1개/)).toBeTruthy();
      const plus = screen.getByRole("button", { name: "수량 늘리기" });
      fireEvent.click(plus);
      expect(plus).toHaveProperty("disabled", true);
    });

    it("남은 수량이 없으면(환불 처리 중인 취소가 전부) → 취소 요청 버튼이 없다", async () => {
      signIn();
      getOrder.mockResolvedValue(TWO);
      listClaims.mockResolvedValue([cancelled("refunding", 2)]);
      await renderPage();
      expect(screen.queryByRole("button", { name: "주문 취소 요청" })).toBeNull();
    });
  });

  it("끝나지 않은 다른 환불(REFUND_IN_PROGRESS) → 잠시 뒤에 다시", async () => {
    signIn();
    getOrder.mockResolvedValue(ORDER);
    createClaim.mockRejectedValue(new ApiClientError("REFUND_IN_PROGRESS", "x", 409));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "주문 취소 요청" }));
    await sendCancel();
    expect(screen.getByRole("alert").textContent).toBe(
      "아직 끝나지 않은 환불이 있어요. 잠시 뒤에 다시 시도해 주세요.",
    );
  });

  it("취소할 수 없는 주문(CLAIM_NOT_ALLOWED) → 고객센터 안내", async () => {
    signIn();
    getOrder.mockResolvedValue(ORDER);
    createClaim.mockRejectedValue(new ApiClientError("CLAIM_NOT_ALLOWED", "x", 409));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "주문 취소 요청" }));
    await sendCancel();
    expect(screen.getByRole("alert").textContent).toBe(
      "이 주문은 지금 취소·반품을 신청할 수 없어요. 고객센터로 문의해 주세요.",
    );
  });

  it("결제 대기 취소가 막히면(ORDER_NOT_CANCELLABLE) → 그 이유, 모르는 실패면 다시 시도 안내", async () => {
    signIn();
    getOrder.mockResolvedValue(PENDING);
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

  it("결제 대기 취소인데 토스가 이미 승인했으면(ORDER_ALREADY_PAID) → 그 안내 + 다시 읽어 결제된 주문(취소 요청 버튼)", async () => {
    signIn();
    getOrder.mockResolvedValueOnce(PENDING).mockResolvedValue(ORDER);
    cancelOrder.mockRejectedValueOnce(new ApiClientError("ORDER_ALREADY_PAID", "x", 409));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "주문 취소" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "취소하기" }));
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "결제가 이미 끝난 주문이에요. 주문을 다시 불러왔어요. 취소하려면 아래 '주문 취소 요청'을 눌러 주세요.",
    );
    expect(screen.getByRole("button", { name: "주문 취소 요청" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "주문 취소" })).toBeNull();
  });

  it.each([
    [
      "PAYMENT_GATEWAY_UNAVAILABLE",
      503,
      "결제 상태를 확인하지 못해 아직 취소하지 않았어요. 잠시 후 다시 시도해 주세요.",
    ],
    [
      "PAYMENT_IN_PROGRESS",
      409,
      "결제를 확인하고 있어요. 잠시 후 다시 시도해 주세요. 결제가 끝나지 않았다면 10분 안에 자동으로 닫혀요.",
    ],
  ])("결제 대기 취소가 %s → 이 버튼의 안내(주문은 그대로)", async (code, status, text) => {
    signIn();
    getOrder.mockResolvedValue(PENDING);
    cancelOrder.mockRejectedValueOnce(new ApiClientError(code, "x", status));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "주문 취소" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "취소하기" }));
    });
    expect(screen.getByRole("alert").textContent).toBe(text);
  });

  it("자동 환불 중인 주문(status pending · 결제 refunding) → 환불 처리 중, 결제하기·주문 취소 버튼 없음", async () => {
    signIn();
    getOrder.mockResolvedValue({
      ...ORDER,
      state: "refunding",
      status: "pending",
      paymentStatus: "refunding",
    });
    await renderPage();
    expect(screen.queryByRole("button", { name: "주문 취소" })).toBeNull();
    expect(screen.queryByText("이 주문 결제하기")).toBeNull();
  });

  it("상품 준비 중(발송 전) → 아직 취소 요청할 수 있다", async () => {
    signIn();
    getOrder.mockResolvedValue(PREPARING);
    await renderPage();
    expect(stateBadge("상품준비중")).toBeTruthy();
    expect(screen.getByRole("button", { name: "주문 취소 요청" })).toBeTruthy();
  });

  it("발송됨 → 택배사·송장번호와 배송 조회(새 탭), 취소 요청은 없다", async () => {
    signIn();
    getOrder.mockResolvedValue({
      ...SHIPPING,
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

  it("배송중 → 취소 버튼 자리에 '발송된 주문은 취소할 수 없어요' 안내와 문의 메일", async () => {
    signIn();
    getOrder.mockResolvedValue(SHIPPING);
    await renderPage();
    expect(screen.getByText(/발송된 주문은 취소할 수 없어요/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "hello@takesuaci.com" }).getAttribute("href")).toBe(
      "mailto:hello@takesuaci.com",
    );
  });

  it("배송 완료 → '받은 뒤 신청해 주세요' 안내 없이 반품·교환 버튼과 문의 메일", async () => {
    signIn();
    getOrder.mockResolvedValue({
      ...ORDER,
      state: "delivered",
      fulfillmentStatus: "delivered",
      deliveredAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    });
    await renderPage();
    expect(screen.queryByText(/발송된 주문은 취소할 수 없어요/)).toBeNull();
    expect(screen.getByRole("button", { name: "반품 신청" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "hello@takesuaci.com" })).toBeTruthy();
  });

  it("보상 환불(회사가 금액만 돌려줌) → 내역에 '보상 환불'·금액·사유 글·보상 날짜, 품목 줄·신청 날짜 없음", async () => {
    signIn();
    getOrder.mockResolvedValue({
      ...ORDER,
      state: "partiallyRefunded",
      fulfillmentStatus: "delivered",
      paymentStatus: "partially_refunded",
    });
    listClaims.mockResolvedValue([
      {
        claimId: "cp1",
        orderId: "o1",
        type: "compensation",
        status: "refunded",
        reasonCode: "상품하자",
        reasonDetail: "누액으로 일부를 못 써서 보상해 드려요",
        lines: [],
        refundAmount: 10000,
        refundedShipping: 0,
        returnShippingFee: 0,
        photoCount: 0,
        createdAt: Date.parse("2026-11-20T10:00:00+09:00"),
        createdDtm: "",
      },
    ]);
    await renderPage();
    const item = (await screen.findByText(/보상 환불 ·/)).closest("li") as HTMLElement;
    expect(within(item).getByText("환불 완료")).toBeTruthy();
    expect(within(item).getByText("누액으로 일부를 못 써서 보상해 드려요")).toBeTruthy();
    expect(within(item).getByText(/보상$/)).toBeTruthy();
    expect(within(item).queryByText(/ × /)).toBeNull();
    expect(within(item).queryByText(/신청$/)).toBeNull();
  });

  it("배송 완료 3개월이 지나 반품 버튼이 없어도 → 막다른 길이 아니게 문의 메일", async () => {
    signIn();
    getOrder.mockResolvedValue({
      ...ORDER,
      state: "delivered",
      fulfillmentStatus: "delivered",
      deliveredAt: Date.now() - 120 * 24 * 60 * 60 * 1000,
    });
    await renderPage();
    expect(screen.queryByRole("button", { name: "반품 신청" })).toBeNull();
    expect(screen.getByRole("heading", { name: "주문 관리" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "hello@takesuaci.com" })).toBeTruthy();
  });

  it.each([
    ["refunding", "환불 처리 중"],
    ["refund_failed", "환불 처리 중"],
    ["refunded", "환불 완료"],
  ] as const)("취소 클레임 %s → '%s'", async (status, label) => {
    signIn();
    getOrder.mockResolvedValue({
      ...ORDER,
      state: "partiallyRefunded",
      paymentStatus: "partially_refunded",
    });
    listClaims.mockResolvedValue([
      {
        claimId: "c1",
        orderId: "o1",
        type: "cancel",
        status,
        reasonCode: "단순변심",
        lines: [],
        refundAmount: 31000,
        refundedShipping: 3000,
        returnShippingFee: 0,
        photoCount: 0,
        createdAt: 0,
        createdDtm: "",
      },
    ]);
    await renderPage();
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("없는 주문(ORDER_NOT_FOUND) → 다시 시도 대신 찾을 수 없다는 말과 주문 내역 길", async () => {
    signIn();
    getOrder.mockRejectedValue(new ApiClientError("ORDER_NOT_FOUND", "x", 404));
    await renderPage();
    expect((await screen.findByRole("alert")).textContent).toBe(
      "주문을 찾을 수 없어요. 주문 내역에서 다시 찾아 주세요.",
    );
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
    expect(screen.getByRole("link", { name: /주문 내역으로/ })).toBeTruthy();
  });

  it("모르는 택배사 코드·조회 링크 없음 → 코드와 송장번호만, 버튼은 없다", async () => {
    signIn();
    getOrder.mockResolvedValue({
      ...ORDER,
      state: "delivered",
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
    const delivered = (daysAgo: number, state: OrderState = "delivered"): Order => ({
      ...ORDER,
      state,
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
      photoCount: 0,
      createdAt: Date.now(),
      createdDtm: "",
      ...over,
    });

    it("받은 지 이틀 → 단순 변심은 미개봉 확인 전엔 못 보내고, 반품 배송비를 뺀 예상 환불 금액을 보여 준 뒤 신청", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(2));
      previewRefund.mockResolvedValue({
        ...FULL_REFUND,
        refundedShipping: 0,
        returnShippingFee: 3000,
        refundAmount: 25000,
      });
      createReturn.mockResolvedValue({});
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: "반품 신청" }));
      // 사유를 고르기 전엔 금액 칸이 없고 신청 버튼 옆에 이유가 보인다(UX 리뷰 F1·F3)
      expect(screen.queryByRole("region", { name: "예상 환불 금액" })).toBeNull();
      expect(screen.getByText("사유를 골라 주세요.")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "단순 변심" }));
      const quote = screen.getByRole("region", { name: "예상 환불 금액" });
      await waitFor(() => expect(quote.textContent).toContain("환불 예정 금액₩25,000"));
      expect(quote.textContent).toContain("반품 배송비 (고객 부담)−₩3,000");
      expect(previewRefund).toHaveBeenCalledWith("o1", { type: "return", reasonCode: "단순변심" });
      const submit = screen.getByRole("button", { name: "반품 신청하기" });
      expect(submit).toHaveProperty("disabled", true);
      expect(screen.getByText(/체크해 주세요/)).toBeTruthy();
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
      await waitFor(() => expect(quote.textContent).toContain("환불 예정 금액₩31,000"));
      expect(quote.textContent).toContain("처음 낸 배송비 환불+₩3,000");
      expect(screen.getByRole("button", { name: "반품 신청하기" })).toHaveProperty(
        "disabled",
        false,
      );
    });

    it("받은 지 열흘 → 단순 변심은 고를 수 없고, 어느 사유도 미리 골라 두지 않는다", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(10));
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: "반품 신청" }));
      expect(screen.getByRole("button", { name: "단순 변심" })).toHaveProperty("disabled", true);
      expect(
        screen
          .getByRole("button", { name: "상품 불량(파손·누액 포함)" })
          .getAttribute("aria-pressed"),
      ).toBe("false");
      expect(screen.getByText(/단순 변심 반품은 받은 날부터 7일까지/)).toBeTruthy();
    });

    it("서버가 기한 지남으로 막으면 → 그 이유", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(2));
      createReturn.mockRejectedValue(new ApiClientError("RETURN_WINDOW_CLOSED", "x", 409));
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: "반품 신청" }));
      fireEvent.click(screen.getByRole("button", { name: "오배송" }));
      const submit = await readyButton("반품 신청하기");
      await act(async () => {
        fireEvent.click(submit);
      });
      expect(screen.getByRole("alert").textContent).toBe(
        "반품 신청 기간이 지났어요. 고객센터로 문의해 주세요.",
      );
    });

    it("배송중에 신청한 반품이 진행 중 → '받은 뒤 신청해 주세요' 안내 없이 배송 단계는 그대로", async () => {
      signIn();
      getOrder.mockResolvedValue({ ...SHIPPING, state: "returnInProgress" });
      listClaims.mockResolvedValue([returnClaim({})]);
      await renderPage();
      expect(stateBadge("반품 진행 중")).toBeTruthy();
      expect(screen.queryByText(/발송된 주문은 취소할 수 없어요/)).toBeNull();
      const steps = screen.getByRole("list", { name: "진행 단계" });
      expect(steps.querySelector('[aria-current="step"]')?.textContent).toBe("배송중");
    });

    it("진행 중인 반품이 있으면 버튼 대신 내역에 '반품 신청됨'과 보낼 곳 안내", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(2, "returnInProgress"));
      listClaims.mockResolvedValue([returnClaim({})]);
      await renderPage();
      expect(screen.queryByRole("button", { name: "반품 신청" })).toBeNull();
      expect(screen.getByText("반품 신청됨")).toBeTruthy();
      expect(screen.getByText("반품 배송비 ₩3,000 차감")).toBeTruthy();
      expect(screen.getByText(/보내실 곳과 방법을 메일로 안내해 드려요/)).toBeTruthy();
    });

    it("교환 새 제품 발송 → '교환 상품 발송'·택배사·송장·배송 조회(새 탭), 금액 대신 수량", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(5, "exchangeInProgress"));
      listClaims.mockResolvedValue([
        returnClaim({
          type: "exchange",
          status: "shipped",
          reasonCode: "상품하자",
          refundAmount: 0,
          returnShippingFee: 0,
          photoCount: 0,
          carrier: "hanjin",
          trackingNumber: "555",
          trackingUrl: "https://hanjin.example/555",
        }),
      ]);
      await renderPage();
      expect(screen.getByText("교환 상품 발송")).toBeTruthy();
      expect(screen.getByText("교환 · 상품 불량(파손·누액 포함)")).toBeTruthy();
      expect(screen.getByText("한진택배 555")).toBeTruthy();
      const links = screen.getAllByRole("link", { name: "배송 조회" });
      expect(links.map((a) => a.getAttribute("href"))).toContain("https://hanjin.example/555");
      expect(screen.getByText("1개")).toBeTruthy();
      expect(screen.queryByText("₩0")).toBeNull();
    });

    it("회수 송장이 들어오면 → '회수 송장 · 상태'·택배사·송장·배송 조회, 모르는 상태는 이름 없이", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(5, "returnInProgress"));
      listClaims.mockResolvedValue([
        returnClaim({
          claimId: "r1",
          pickupCarrier: "cj",
          pickupTrackingNumber: "555566667777",
          pickupTrackingUrl: "https://cj.example/555566667777",
          pickupStatus: "IN_TRANSIT",
        }),
        returnClaim({
          claimId: "r2",
          status: "withdrawn",
          pickupCarrier: "epost",
          pickupTrackingNumber: "1234567890123",
          pickupStatus: "SOMETHING_NEW",
        }),
      ]);
      await renderPage();
      expect(screen.getByText("회수 송장 · 이동 중")).toBeTruthy();
      expect(screen.getByText("CJ대한통운 555566667777")).toBeTruthy();
      const links = screen.getAllByRole("link", { name: "배송 조회" });
      expect(links.map((a) => a.getAttribute("href"))).toContain("https://cj.example/555566667777");
      expect(screen.getByText("우체국택배 1234567890123")).toBeTruthy();
      expect(screen.getByText("회수 송장")).toBeTruthy();
    });

    it("거절된 교환 → '교환 거절'과 이유, 철회한 반품 → '신청 철회'", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(5));
      listClaims.mockResolvedValue([
        returnClaim({
          claimId: "e1",
          type: "exchange",
          status: "rejected",
          rejectReason: "새 제품과 같은 상태예요",
        }),
        returnClaim({ claimId: "r2", status: "withdrawn" }),
      ]);
      await renderPage();
      expect(screen.getByText("교환 거절")).toBeTruthy();
      expect(screen.getByText("거절 이유: 새 제품과 같은 상태예요")).toBeTruthy();
      expect(screen.getByText("신청 철회")).toBeTruthy();
    });

    it("신청 상태 반품 → '신청 철회'는 한 번 더 묻고, 철회하면 다시 불러온다", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(2, "returnInProgress"));
      listClaims.mockResolvedValue([returnClaim({})]);
      withdrawClaim.mockResolvedValue({});
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: "신청 철회" }));
      expect(screen.getByText(/이 신청을 철회할까요\?/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "돌아가기" }));
      expect(withdrawClaim).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "신청 철회" }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "철회하기" }));
      });
      expect(withdrawClaim).toHaveBeenCalledWith("o1", "r1");
      expect(getOrder).toHaveBeenCalledTimes(2);
    });

    it("회수 확인 뒤(환불 처리 중) 반품 → 철회 버튼이 없다", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(2, "returnInProgress"));
      listClaims.mockResolvedValue([returnClaim({ status: "refunding" })]);
      await renderPage();
      expect(screen.queryByRole("button", { name: "신청 철회" })).toBeNull();
    });

    it("이미 처리가 시작됐으면(CLAIM_NOT_WITHDRAWABLE) → 그 이유 + 내역을 다시 불러온다", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(2, "exchangeInProgress"));
      listClaims.mockResolvedValue([returnClaim({ type: "exchange" })]);
      withdrawClaim.mockRejectedValue(new ApiClientError("CLAIM_NOT_WITHDRAWABLE", "x", 409));
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: "신청 철회" }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "철회하기" }));
      });
      expect(screen.getByRole("alert").textContent).toBe(
        "이미 처리가 시작돼 철회할 수 없어요. 내역을 다시 확인해 주세요.",
      );
      expect(getOrder).toHaveBeenCalledTimes(2);
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

  describe("교환 신청", () => {
    const DAY = 24 * 60 * 60 * 1000;
    const delivered = (daysAgo: number): Order => ({
      ...ORDER,
      state: "delivered",
      fulfillmentStatus: "delivered",
      deliveredAt: Date.now() - daysAgo * DAY,
    });

    it("받은 뒤 → 사유 셋(단순 변심 없음)·새 제품 안내·단순 변심 길 안내를 보고 신청", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(2));
      createExchange.mockResolvedValue({});
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: "교환 신청" }));
      expect(screen.getByText("교환 사유 선택")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "단순 변심" })).toBeNull();
      expect(screen.getByRole("button", { name: "오배송" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "상품 정보와 다름" })).toBeTruthy();
      expect(
        screen.getByText("같은 제품의 새 제품으로 바꿔 드려요. 배송비는 저희가 내요."),
      ).toBeTruthy();
      expect(
        screen.getByText(/단순 변심은 반품 후 새로 주문해 주세요\(왕복 배송비와 같아요\)/),
      ).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "오배송" }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "교환 신청하기" }));
      });
      expect(createExchange).toHaveBeenCalledWith(
        "o1",
        expect.objectContaining({ reasonCode: "오배송", lines: undefined }),
      );
    });

    it("교환 폼을 열면 반품 폼은 닫힌다(한 번에 하나)", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(2));
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: "반품 신청" }));
      expect(screen.getByText("반품 사유 선택")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "교환 신청" }));
      expect(screen.queryByText("반품 사유 선택")).toBeNull();
      expect(screen.getByText("교환 사유 선택")).toBeTruthy();
    });

    it("서버가 기한 지남으로 막으면(EXCHANGE_WINDOW_CLOSED) → 그 이유", async () => {
      signIn();
      getOrder.mockResolvedValue(delivered(2));
      createExchange.mockRejectedValue(new ApiClientError("EXCHANGE_WINDOW_CLOSED", "x", 409));
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: "교환 신청" }));
      fireEvent.click(screen.getByRole("button", { name: "상품 불량(파손·누액 포함)" }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "교환 신청하기" }));
      });
      expect(screen.getByRole("alert").textContent).toBe(
        "교환 신청 기간(받은 날부터 3개월)이 지났어요. 고객센터로 문의해 주세요.",
      );
    });

    it("발송 전·진행 중 교환이 있으면 → 교환 신청 버튼이 없다", async () => {
      signIn();
      getOrder.mockResolvedValue(ORDER);
      await renderPage();
      expect(screen.queryByRole("button", { name: "교환 신청" })).toBeNull();
    });
  });

  describe("배송지 변경", () => {
    const HOME = {
      addressId: "a1",
      label: "집",
      recipient: "지우",
      phone: "010-1234-5678",
      zipcode: "13529",
      addr1: "판교역로 166",
      isDefault: true,
    };
    const OFFICE = {
      addressId: "a2",
      label: "회사",
      recipient: "지우",
      phone: "010-1234-5678",
      zipcode: "06236",
      addr1: "테헤란로 152",
      addr2: "12층",
      isDefault: false,
    };

    it("결제완료(상품 준비 전) → 배송지 목록에서 골라 바꾸면 주문 배송지가 바뀐다", async () => {
      signIn();
      getOrder.mockResolvedValue(ORDER);
      listAddresses.mockResolvedValue([HOME, OFFICE]);
      changeShippingAddress.mockResolvedValue({
        ...ORDER,
        shippingAddress: {
          recipient: "지우",
          phone: "010-1234-5678",
          zipcode: "06236",
          addr1: "테헤란로 152",
          addr2: "12층",
        },
      });
      await renderPage();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "배송지 변경" }));
      });
      expect(screen.getByRole("link", { name: "새 배송지 추가" }).getAttribute("href")).toBe(
        "/account/addresses",
      );
      fireEvent.click(screen.getByRole("radio", { name: /회사/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "이 주소로 바꾸기" }));
      });
      expect(changeShippingAddress).toHaveBeenCalledWith("o1", { addressId: "a2" });
      expect(screen.getByText(/테헤란로 152/)).toBeTruthy();
      expect(screen.getByText("배송지를 바꿨어요.")).toBeTruthy();
    });

    it("서버가 막으면(ADDRESS_CHANGE_NOT_ALLOWED) → 그 이유", async () => {
      signIn();
      getOrder.mockResolvedValue(ORDER);
      listAddresses.mockResolvedValue([HOME, OFFICE]);
      changeShippingAddress.mockRejectedValue(
        new ApiClientError("ADDRESS_CHANGE_NOT_ALLOWED", "x", 409),
      );
      await renderPage();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "배송지 변경" }));
      });
      fireEvent.click(screen.getByRole("radio", { name: /회사/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "이 주소로 바꾸기" }));
      });
      expect(screen.getByRole("alert").textContent).toBe(
        "상품 준비가 시작돼 배송지를 바꿀 수 없어요. 고객센터로 문의해 주세요.",
      );
    });

    it("상품준비중 → 변경 버튼 대신 메일 안내", async () => {
      signIn();
      getOrder.mockResolvedValue(PREPARING);
      await renderPage();
      expect(screen.queryByRole("button", { name: "배송지 변경" })).toBeNull();
      expect(screen.getByText(/포장을 시작해서 배송지를 바꾸려면/)).toBeTruthy();
    });

    it("배송중 → 변경 버튼도 안내도 없다", async () => {
      signIn();
      getOrder.mockResolvedValue(SHIPPING);
      await renderPage();
      expect(screen.queryByRole("button", { name: "배송지 변경" })).toBeNull();
      expect(screen.queryByText(/포장을 시작해서 배송지를 바꾸려면/)).toBeNull();
    });
  });
});

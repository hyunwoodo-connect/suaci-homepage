import { displayTotal } from "@/constants/checkout";
import { PRODUCT } from "@/constants/product";
import { api } from "@/lib/api";
import { saveMemo } from "@/lib/checkout/memo";

import { clearPendingOrder, createOrderReusingPending, savePendingOrder } from "./pending";
import type { PayMethodId, PaymentAdapter } from "./providers";

/** `startPayment` 입력 — 주문서·재구매 시트가 고른 수단·수량·배송지·메모 */
export interface StartPaymentInput {
  adapter: PaymentAdapter;
  method: PayMethodId;
  qty: number;
  addressId: string;
  memo: string;
  /** 주문을 만든 화면(주문 metadata.screen) */
  screen: "checkout" | "rebuy-sheet";
  /** 토스 customerKey — 우리 userId */
  customerKey: string;
}

/** 결제 시작 결과 — 결제창이 닫혔으면 빈 값, 이미 결제된 주문이면 그 id */
export interface StartPaymentOutcome {
  alreadyPaidOrderId?: string;
}

/**
 * 바로 구매 결제 시작 — 주문서와 재구매 시트가 같이 쓴다. 배송 메모를 다음 기본으로 남기고, 주문을 만들고
 * (30분 안의 같은 보류 주문은 같은 멱등키로), 보류 주문으로 적어 둔 뒤 결제창을 연다.
 * 결제창이 뜨면 페이지가 떠나 끝나지 않는다 — 끝났다면 손님이 결제창을 닫은 것이다.
 * 실패는 그대로 던진다(주문 API 는 ApiClientError, 결제창은 그 SDK 오류). 화면이 orderErrorKey 로 문구를 고른다.
 * 이어 쓴 보류 주문이 이미 결제됐으면(다른 탭·늦게 온 승인) 결제창을 열지 않고 그 주문 id 를 돌려준다 — 화면이 주문 상세로 보낸다.
 */
export async function startPayment(input: StartPaymentInput): Promise<StartPaymentOutcome> {
  const { adapter, method, qty, addressId, memo, screen, customerKey } = input;
  saveMemo(memo);
  // 금액·배송지·메모가 전부 같을 때만 기존 키 — 서버는 멱등 히트면 입력을 무시한다
  const { order, idempotencyKey } = await createOrderReusingPending(
    (key) =>
      api.createOrder({
        addressId,
        idempotencyKey: key,
        // 바로 구매 — 장바구니를 거치지 않고 이 화면의 상품·수량을 주문에 싣는다
        items: [{ productId: PRODUCT.productId, variantId: PRODUCT.variantId, quantity: qty }],
        metadata: { deliveryMemo: memo, channel: "web", screen },
      }),
    { amount: displayTotal(qty), addressId, memo },
  );
  // 결제 전(pending)이 아니면 이미 처리된 주문이다(닫힌 voided 는 위에서 새 주문으로 바꿨다) — 같은 주문번호로 결제창을 또 열면 토스 오류 화면으로 빠진다
  if (order.paymentStatus !== "pending") {
    clearPendingOrder();
    return { alreadyPaidOrderId: order.orderId };
  }
  savePendingOrder({
    orderId: order.orderId,
    orderNo: order.orderNo,
    amount: order.totals.grandTotal,
    idempotencyKey,
    qty,
    addressId,
    memo,
  });
  await adapter.request(method, {
    orderId: order.orderId,
    orderNo: order.orderNo,
    // 결제창·카드 명세에 그대로 보인다 — 사이트의 상품 이름 + 수량
    orderName: `${PRODUCT.name} ${String(qty)}개`,
    amount: order.totals.grandTotal,
    customerKey,
    successPath: `/pay/complete?o=${order.orderId}`,
    failPath: `/pay/fail?o=${order.orderId}`,
  });
  return {};
}

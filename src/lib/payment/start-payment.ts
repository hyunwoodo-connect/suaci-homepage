import { displayTotal } from "@/constants/checkout";
import { PRODUCT } from "@/constants/product";
import { api } from "@/lib/api";
import { saveMemo } from "@/lib/checkout/memo";

import { createOrderReusingPending, savePendingOrder } from "./pending";
import type { PayMethodId, PaymentAdapter } from "./providers";

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

/**
 * 바로 구매 결제 시작 — 주문서와 재구매 시트가 같이 쓴다. 배송 메모를 다음 기본으로 남기고, 주문을 만들고
 * (30분 안의 같은 보류 주문은 같은 멱등키로), 보류 주문으로 적어 둔 뒤 결제창을 연다.
 * 결제창이 뜨면 페이지가 떠나 끝나지 않는다 — 끝났다면 손님이 결제창을 닫은 것이다.
 * 실패는 그대로 던진다(주문 API 는 ApiClientError, 결제창은 그 SDK 오류). 화면이 orderErrorKey 로 문구를 고른다.
 */
export async function startPayment(input: StartPaymentInput): Promise<void> {
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
    orderName: `${PRODUCT.name} ${String(qty)}`,
    amount: order.totals.grandTotal,
    customerKey,
    successPath: `/pay/complete?o=${order.orderId}`,
    failPath: `/pay/fail?o=${order.orderId}`,
  });
}

/**
 * 토스페이먼츠 결제창 어댑터(SDK v2, API 개별 연동 키 `*_ck_*`).
 * 카드는 통합결제창, 카카오페이·네이버페이는 그 페이 창을 바로 연다. 결제가 끝나면 토스가 successUrl 로 보내고
 * `/pay/complete` 가 서버 승인을 부른다. 브랜드페이는 따로 계약이라 여기 없다.
 * SDK 는 결제 버튼을 누를 때만 불러온다 — 첫 화면에 토스 스크립트를 싣지 않는다.
 */
import type { PayMethodId, PaymentAdapter, PaymentRequestInput } from "./providers";

/** 토스 결제창이 다루는 수단(노출 순서는 providers 의 METHOD_ORDER 와 같다) */
const TOSS_METHODS: readonly PayMethodId[] = ["KAKAOPAY", "NAVERPAY", "CARD"];

/** SDK 에서 쓰는 만큼만 — 테스트는 가짜 로더를 꽂는다 */
interface TossPaymentRequest {
  method: "CARD";
  amount: { currency: "KRW"; value: number };
  orderId: string;
  orderName: string;
  successUrl: string;
  failUrl: string;
  card: { flowMode: "DEFAULT" } | { flowMode: "DIRECT"; easyPay: "KAKAOPAY" | "NAVERPAY" };
}

interface TossPaymentsLike {
  payment(options: { customerKey: string }): {
    requestPayment(request: TossPaymentRequest): Promise<unknown>;
  };
}

interface TossAdapterDeps {
  clientKey: string;
  origin: string;
  load?: (clientKey: string) => Promise<TossPaymentsLike>;
}

/** 토스 결제창 어댑터 */
export function createTossAdapter(deps: TossAdapterDeps): PaymentAdapter {
  const load = deps.load ?? loadSdk;
  return {
    id: "toss",
    methods: TOSS_METHODS,
    async request(method: PayMethodId, input: PaymentRequestInput) {
      const toss = await load(deps.clientKey);
      try {
        await toss.payment({ customerKey: input.customerKey }).requestPayment({
          method: "CARD",
          amount: { currency: "KRW", value: input.amount },
          // 토스 주문번호 = 사람용 주문번호(서버 승인이 이 값으로 토스에 되묻는다)
          orderId: input.orderNo,
          orderName: input.orderName,
          successUrl: `${deps.origin}${input.successPath}`,
          failUrl: `${deps.origin}${input.failPath}`,
          card:
            method === "KAKAOPAY" || method === "NAVERPAY"
              ? { flowMode: "DIRECT", easyPay: method }
              : { flowMode: "DEFAULT" },
        });
      } catch (e) {
        // 손님이 결제창을 닫은 것 — 오류가 아니다. 버튼만 다시 눌리면 된다(주문은 '이어서 할까요?'로 남는다)
        if (errorCode(e) === "USER_CANCEL") return;
        throw e;
      }
    },
  };
}

/** 테스트 키(`test_`)면 돈이 움직이지 않는다 — 화면에 시험 결제임을 알린다 */
export function isTestClientKey(clientKey: string | undefined): boolean {
  return clientKey?.startsWith("test_") ?? false;
}

/* ─── 내부 ─────────────────────────── */

async function loadSdk(clientKey: string): Promise<TossPaymentsLike> {
  const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
  return loadTossPayments(clientKey);
}

function errorCode(e: unknown): string | undefined {
  return typeof e === "object" && e !== null && "code" in e && typeof e.code === "string"
    ? e.code
    : undefined;
}

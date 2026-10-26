/**
 * 결제 어댑터 포트 — 오너 지시(심사를 기다리지 않는다): 지금은 목업 어댑터가 결제창을 흉내 내고,
 * 실키가 오면 같은 모양의 토스 위젯/직가맹 어댑터를 꽂는다(두 형태 다 수용 — 어댑터 목록이라서).
 * 운영(main) + 실서버(http) 조합에서 목업은 절대 켜지지 않는다.
 */
import { BRANDPAY_LABEL } from "@/constants/checkout";
import type { SocialProvider } from "@/types";

export type PayMethodId = "BRANDPAY" | "KAKAOPAY" | "NAVERPAY" | "CARD";

/** 화면에 보이는 수단 이름. BRANDPAY 는 가칭(시우 결정 전) */
export const PAY_METHOD_LABEL: Record<PayMethodId, string> = {
  BRANDPAY: BRANDPAY_LABEL,
  KAKAOPAY: "카카오페이",
  NAVERPAY: "네이버페이",
  CARD: "카드",
};

/** 수단 노출 순서 — 스펙 §3(브랜드페이 먼저) */
const METHOD_ORDER: readonly PayMethodId[] = ["BRANDPAY", "KAKAOPAY", "NAVERPAY", "CARD"];

export interface PaymentRequestInput {
  orderId: string;
  orderNo: string;
  orderName: string;
  amount: number;
  /** 토스 customerKey 규칙 — 우리 userId */
  customerKey: string;
  /** 쿼리까지 포함한 앱 안 경로. 어댑터가 &paymentKey… 를 이어 붙인다 */
  successPath: string;
  failPath: string;
}

/** 결제창 하나 — 어떤 수단을 다루는지(methods)와 결제창 열기(request) */
export interface PaymentAdapter {
  id: string;
  methods: readonly PayMethodId[];
  request(method: PayMethodId, input: PaymentRequestInput): Promise<void>;
}

interface MockAdapterDeps {
  origin: string;
  navigate(url: string): void;
  newKey?(): string;
}

/** 목업 결제창 — 결제창 대신 곧장 성공 리다이렉트(키 모양은 백엔드 목업 게이트웨이 계약) */
export function createMockAdapter(deps: MockAdapterDeps): PaymentAdapter {
  const newKey = deps.newKey ?? (() => crypto.randomUUID().replaceAll("-", ""));
  return {
    id: "mock",
    methods: METHOD_ORDER,
    request(method, input) {
      const q = `paymentKey=mock_${method}_${newKey()}&orderId=${encodeURIComponent(input.orderNo)}&amount=${String(input.amount)}`;
      deps.navigate(`${deps.origin}${input.successPath}&${q}`);
      return Promise.resolve();
    },
  };
}

/** 환경에 맞는 어댑터 목록. 토스 실키가 오면 여기서 위젯 어댑터를 돌려준다 */
export function selectPaymentAdapters(
  env: { tossClientKey?: string; apiMode: string; nodeEnv: string },
  deps?: MockAdapterDeps,
): PaymentAdapter[] {
  // TODO(키): 토스 위젯 어댑터 — 실키가 오면 구현해 여기 먼저 넣는다
  if (env.tossClientKey) return [];
  const mockAllowed = env.apiMode === "mock" || env.nodeEnv !== "production";
  return mockAllowed && deps ? [createMockAdapter(deps)] : [];
}

/** 이 수단을 다루는 어댑터(없으면 null — 버튼이 준비 중 안내) */
export function adapterFor(adapters: PaymentAdapter[], method: PayMethodId): PaymentAdapter | null {
  return adapters.find((a) => a.methods.includes(method)) ?? null;
}

/** 화면에 보일 수단 — 어댑터들이 다루는 수단의 합집합을 고정 순서로 */
export function availableMethods(adapters: PaymentAdapter[]): PayMethodId[] {
  const set = new Set(adapters.flatMap((a) => a.methods));
  return METHOD_ORDER.filter((m) => set.has(m));
}

/** 백엔드가 남긴 수단 이름("간편결제(네이버페이)"·"브랜드페이"…) → 수단 id. 모르는 이름은 null */
export function methodFromLabel(label: string | null): PayMethodId | null {
  if (!label) return null;
  if (label.includes("브랜드페이")) return "BRANDPAY";
  if (label.includes("카카오페이")) return "KAKAOPAY";
  if (label.includes("네이버페이")) return "NAVERPAY";
  if (label === "카드" || label.includes("카드")) return "CARD";
  return null;
}

/** 시트 기본 수단 — 지난 수단 ?? 로그인 프로바이더의 페이 ?? 카드 (스펙 §1) */
export function defaultMethod(opts: {
  lastPaymentMethod: string | null;
  loginProvider?: SocialProvider | null;
}): PayMethodId {
  const last = methodFromLabel(opts.lastPaymentMethod);
  if (last) return last;
  if (opts.loginProvider === "kakao") return "KAKAOPAY";
  if (opts.loginProvider === "naver") return "NAVERPAY";
  return "CARD";
}

/** 결제 복귀 쿼리 해석 — 셋 다 있고 amount 가 정수일 때만. 아니면 null(변조·잘못 들어옴) */
export function parsePaymentReturn(
  q: URLSearchParams,
): { paymentKey: string; orderNo: string; amount: number } | null {
  const paymentKey = q.get("paymentKey");
  const orderNo = q.get("orderId");
  const amountRaw = q.get("amount");
  if (!paymentKey || !orderNo || !amountRaw) return null;
  const amount = Number(amountRaw);
  if (!Number.isInteger(amount) || amount <= 0) return null;
  return { paymentKey, orderNo, amount };
}

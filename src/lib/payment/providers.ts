/**
 * 결제 어댑터 포트 — 토스 클라이언트 키(NEXT_PUBLIC_TOSS_CLIENT_KEY)가 있으면 토스 결제창(`./toss`),
 * 없으면 목업 어댑터가 결제창을 흉내 낸다(개발·목업 API).
 * 운영(main) + 실서버(http) 조합에서 목업은 절대 켜지지 않는다 — 키가 없으면 운영은 결제 직전까지만 보여 준다.
 */
import type { SocialProvider } from "@/types";

import { createTossAdapter } from "./toss";

export type PayMethodId = "BRANDPAY" | "KAKAOPAY" | "NAVERPAY" | "CARD";

/**
 * 결제를 열기 전 주문서에 흐리게 보여 주는 수단 — 카드 심사자가 어떤 수단을 받을지 보게 한다.
 * 실제 고르는 수단(PayMethodId)과 따로 둔다: 토스페이처럼 결제창이 붙으면 생길 수단도 미리 보인다.
 * 화면 이름은 메시지 `pay.method.{id}`(BRANDPAY 는 가칭)
 */
export const PREVIEW_METHODS = ["CARD", "KAKAOPAY", "NAVERPAY", "TOSSPAY"] as const;

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

/** 결제창을 여는 데 필요한 브라우저 쪽 값(서버 렌더에선 없다) */
interface AdapterDeps {
  origin: string;
  navigate(url: string): void;
  newKey?(): string;
}

/** 목업 결제창 — 결제창 대신 곧장 성공 리다이렉트(키 모양은 백엔드 목업 게이트웨이 계약) */
export function createMockAdapter(deps: AdapterDeps): PaymentAdapter {
  const newKey = deps.newKey ?? (() => crypto.randomUUID().replaceAll("-", ""));
  return {
    id: "mock",
    methods: METHOD_ORDER,
    request(method, input) {
      const q = `paymentKey=mock_${method}_${newKey()}&orderId=${encodeURIComponent(input.orderNo)}&amount=${String(input.amount)}`;
      deps.navigate(`${deps.origin}${input.successPath}&${q}`);
      // 토스처럼 페이지가 떠나는 동안 끝나지 않는다 — 끝나면 부르는 쪽은 '결제창을 닫음'으로 읽고 버튼을 다시 연다
      return new Promise<void>(() => {});
    },
  };
}

/** 결제창을 고르는 데 쓰는 빌드 환경 */
export interface PaymentEnv {
  tossClientKey?: string;
  apiMode: string;
  nodeEnv: string;
}

/** 이 빌드의 결제 환경 — NEXT_PUBLIC_* 는 빌드 때 박혀서 서버 렌더와 브라우저가 같은 값을 본다 */
export function paymentEnv(): PaymentEnv {
  return {
    tossClientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
    apiMode: process.env.NEXT_PUBLIC_API_MODE ?? "mock",
    nodeEnv: process.env.NODE_ENV,
  };
}

/**
 * 결제를 받을 수 있나(결제창이 하나라도 있나). 창(window) 없이 환경만으로 정해서 서버 렌더와 어긋나지 않는다.
 * false 면 구매 흐름은 결제 직전까지 열려 있고, 결제 버튼 자리에 '결제 준비 중'이 서며 주문은 만들지 않는다.
 */
export function canTakePayment(env: PaymentEnv): boolean {
  if (env.tossClientKey) return true;
  return env.apiMode === "mock" || env.nodeEnv !== "production";
}

/** 환경에 맞는 어댑터 목록. 운영(main) + 실서버(http)에서는 목업이 절대 켜지지 않는다 */
export function selectPaymentAdapters(env: PaymentEnv, deps?: AdapterDeps): PaymentAdapter[] {
  if (!canTakePayment(env) || !deps) return [];
  if (env.tossClientKey)
    return [createTossAdapter({ clientKey: env.tossClientKey, origin: deps.origin })];
  return [createMockAdapter(deps)];
}

/** 이 브라우저 창의 결제창 목록 — 결제 주소로 이 창을 옮긴다. 서버 렌더에선 창이 없어 빈 목록 */
export function browserPaymentAdapters(): PaymentAdapter[] {
  if (typeof window === "undefined") return [];
  return selectPaymentAdapters(paymentEnv(), {
    origin: window.location.origin,
    navigate: (url) => {
      window.location.assign(url);
    },
  });
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

/**
 * 로그인 프로바이더의 간편결제 — 그 계정으로 들어온 사람은 그 페이가 이미 손에 익었다(스펙 §1).
 * 짝이 되는 페이가 없는 프로바이더는 null(카드로 간다). 프로바이더를 늘리면 여기서 짝을 정한다.
 */
const LOGIN_PAY_METHOD: Record<SocialProvider, PayMethodId | null> = {
  kakao: "KAKAOPAY",
  naver: "NAVERPAY",
};

/** 시트 기본 수단 — 지난 수단 ?? 로그인 프로바이더의 페이 ?? 카드 (스펙 §1) */
export function defaultMethod(opts: {
  lastPaymentMethod: string | null;
  loginProvider?: SocialProvider | null;
  /** 지금 결제창이 다루는 수단 — 기본이 여기 없으면 첫째로(목업 시절 브랜드페이 기록 등) */
  available?: readonly PayMethodId[];
}): PayMethodId {
  const loginPay = opts.loginProvider ? LOGIN_PAY_METHOD[opts.loginProvider] : null;
  const picked = methodFromLabel(opts.lastPaymentMethod) ?? loginPay ?? "CARD";
  const available = opts.available ?? [];
  return available.length === 0 || available.includes(picked) ? picked : available[0];
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

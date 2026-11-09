// 방문 분석(GA4)과 메타 픽셀. ID는 환경 변수로만 받고, 비었거나 모양이 틀리면 그 도구는 싣지 않는다.
// 방문자가 허용한 뒤에만 실린다(`lib/analytics-consent`, 개인정보처리방침 6조) — 실리지 않았으면 아래 함수는 아무 일 없이 지나간다.
// 화면 코드는 이 파일의 함수만 부른다.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

const GA4_ID = /^G-[A-Z0-9]{4,20}$/;
const PIXEL_ID = /^\d{10,20}$/;

/** 페이지에 실을 분석 도구 ID. 없거나 모양이 틀리면 null 이고 그 도구는 싣지 않는다 */
export interface AnalyticsIds {
  ga4: string | null;
  pixel: string | null;
}

/** 환경 변수 값 → 실을 ID. 스크립트 안에 그대로 들어가므로 모양이 맞는 것만 통과시킨다 */
export function analyticsIds(ga4: string | undefined, pixel: string | undefined): AnalyticsIds {
  return {
    ga4: ga4 && GA4_ID.test(ga4) ? ga4 : null,
    pixel: pixel && PIXEL_ID.test(pixel) ? pixel : null,
  };
}

/** 이 빌드에 분석 도구가 있는가 — 없으면 동의 배너도 푸터 '쿠키 설정'도 없다 */
export function hasAnalytics(): boolean {
  const ids = analyticsIds(process.env.NEXT_PUBLIC_GA4_ID, process.env.NEXT_PUBLIC_META_PIXEL_ID);
  return Boolean(ids.ga4 || ids.pixel);
}

/** 출시 알림 받기에 이메일을 남긴 순간. GA4 `generate_lead`, 픽셀 `Lead` */
export function trackLead(source?: string): void {
  if (typeof window === "undefined") return;
  window.gtag?.("event", "generate_lead", {
    lead_source: "waitlist",
    ...(source ? { source } : {}),
  });
  window.fbq?.("track", "Lead", { content_name: "waitlist" });
}

/** 결제창을 여는 순간. GA4 `begin_checkout`, 픽셀 `InitiateCheckout` */
export function trackBeginCheckout(value: number, quantity: number): void {
  if (typeof window === "undefined") return;
  window.gtag?.("event", "begin_checkout", { currency: "KRW", value, items: [{ quantity }] });
  window.fbq?.("track", "InitiateCheckout", { currency: "KRW", value, num_items: quantity });
}

const PURCHASE_SENT_KEY = "suaci.analytics.purchased";

/** 결제를 마친 주문 한 건. 같은 주문은 이 브라우저에서 한 번만 보낸다(완료 화면 새로고침) */
export interface PurchaseEvent {
  orderNo: string;
  value: number;
  quantity: number;
}

/**
 * 결제 완료. GA4 `purchase`(transaction_id = 주문번호), 픽셀 `Purchase`(eventID = 주문번호 — 같은 번호는 메타가 한 번으로 센다).
 * 테스트 결제는 부르는 쪽이 거른다(돈이 움직이지 않은 결제를 매출로 세지 않게).
 */
export function trackPurchase(purchase: PurchaseEvent): void {
  if (typeof window === "undefined") return;
  if (!window.gtag && !window.fbq) return;
  if (!markPurchaseSent(purchase.orderNo)) return;
  const { orderNo, value, quantity } = purchase;
  window.gtag?.("event", "purchase", {
    transaction_id: orderNo,
    currency: "KRW",
    value,
    items: [{ quantity }],
  });
  window.fbq?.(
    "track",
    "Purchase",
    { currency: "KRW", value, num_items: quantity },
    { eventID: orderNo },
  );
}

/* ─── 내부 ─────────────────────────── */

/** 처음 보내는 주문이면 기록하고 true. 저장소를 못 쓰면 보낸다(transaction_id·eventID 가 한 번 더 막는다) */
function markPurchaseSent(orderNo: string): boolean {
  try {
    const raw = localStorage.getItem(PURCHASE_SENT_KEY);
    const sent = raw ? (JSON.parse(raw) as string[]) : [];
    if (sent.includes(orderNo)) return false;
    const recent = [...sent, orderNo].slice(-20);
    const serialized = JSON.stringify(recent);
    localStorage.setItem(PURCHASE_SENT_KEY, serialized);
    return true;
  } catch {
    return true;
  }
}

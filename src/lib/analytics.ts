// 방문 분석(GA4)과 메타 픽셀. ID는 환경 변수로만 받고, 비었거나 모양이 틀리면 그 도구는 싣지 않는다.
// 화면 코드는 이 파일의 함수만 부른다(도구가 차단·미설정이어도 아무 일 없이 지나간다).

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

const GA4_ID = /^G-[A-Z0-9]{4,20}$/;
const PIXEL_ID = /^\d{10,20}$/;

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

/** 출시 알림 받기에 이메일을 남긴 순간. GA4 `generate_lead`, 픽셀 `Lead` */
export function trackLead(source?: string): void {
  if (typeof window === "undefined") return;
  window.gtag?.("event", "generate_lead", {
    lead_source: "waitlist",
    ...(source ? { source } : {}),
  });
  window.fbq?.("track", "Lead", { content_name: "waitlist" });
}

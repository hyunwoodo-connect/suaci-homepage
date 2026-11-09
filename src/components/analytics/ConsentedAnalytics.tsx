"use client";

import { useEffect, useRef } from "react";

import { usePathname } from "next/navigation";

import type { AnalyticsIds } from "@/lib/analytics";
import {
  clearAnalyticsCookies,
  stopAnalyticsTools,
  useAnalyticsConsent,
} from "@/lib/analytics-consent";
import { loadAnalyticsTools, sendPageView } from "@/lib/analytics-loader";

import ConsentBanner, { type ConsentCopy } from "./ConsentBanner";

interface ConsentedAnalyticsProps {
  ids: AnalyticsIds;
  copy: ConsentCopy;
  privacyHref: string;
}

/**
 * 동의에 따라 GA4·메타 픽셀을 싣는다 — 허용이면 싣고(화면마다 page_view), 거부면 아무것도, 아직 고르지 않았으면 배너만.
 * 서버 그림에서는 동의를 모르므로 아무것도 그리지 않는다(첫 그림 뒤에 정해진다).
 * 허용하지 않은 채 들어오면 전에 남은 분석 쿠키를 지운다. 다른 탭에서 동의를 거두면 이 탭도 도구를 멈추고 새로고침한다.
 */
export default function ConsentedAnalytics({ ids, copy, privacyHref }: ConsentedAnalyticsProps) {
  const consent = useAnalyticsConsent();
  const pathname = usePathname();
  const loaded = useRef(false);

  useEffect(() => {
    if (consent === undefined) return;
    if (consent === "granted") {
      if (!loaded.current) loadAnalyticsTools(ids);
      loaded.current = true;
      return;
    }
    if (loaded.current) {
      // 이 탭에서 실었는데 동의가 거둬졌다(다른 탭의 '쿠키 설정'·거부) — 멈추고 새로고침해 내린다
      stopAnalyticsTools();
      clearAnalyticsCookies();
      window.location.reload();
      return;
    }
    clearAnalyticsCookies();
  }, [consent, ids]);

  useEffect(() => {
    if (consent !== "granted") return;
    sendPageView(window.location.href);
  }, [consent, pathname]);

  if (consent === null) return <ConsentBanner copy={copy} privacyHref={privacyHref} />;
  return null;
}

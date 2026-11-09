"use client";

import type { AnalyticsIds } from "./analytics";
import { rememberGa4Id } from "./analytics-consent";
import { isSensitiveLocation, safePageLocation } from "./analytics-url";

/**
 * 동의한 뒤 GA4·메타 픽셀을 싣는다. 공식 설치 코드와 같은 대기열(gtag·fbq)을 먼저 만들고 스크립트를 붙인다 —
 * 스크립트가 늦게 와도 그 전에 부른 명령은 대기열에서 처리된다.
 * - GA4: 자동 page_view·구글 신호·광고 개인화를 끈다. page_view 는 `sendPageView` 가 쿼리를 걷어 낸 주소로 보낸다.
 * - 픽셀: 화면 이동 자동 추적(pushState)·자동 이벤트(autoConfig)를 끈다. 주소가 그대로 실리므로 비밀이 있는 화면에서는 보내지 않는다.
 */
export function loadAnalyticsTools(ids: AnalyticsIds): void {
  if (ids.ga4) loadGa4(ids.ga4);
  if (ids.pixel) loadPixel(ids.pixel);
}

/** 지금 화면 한 번 — GA4 는 쿼리를 걷어 낸 주소로, 픽셀은 비밀이 없는 화면에서만 */
export function sendPageView(href: string): void {
  const pageLocation = safePageLocation(href);
  window.gtag?.("event", "page_view", { page_location: pageLocation });
  if (!isSensitiveLocation(href)) window.fbq?.("track", "PageView");
}

/* ─── 내부 ─────────────────────────── */

interface AnalyticsWindow {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: PixelQueue;
  _fbq?: PixelQueue;
}

interface PixelQueue {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: (...args: unknown[]) => void;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
}

function loadGa4(id: string): void {
  const w = window as unknown as AnalyticsWindow;
  if (w.gtag) return;
  w.dataLayer = w.dataLayer ?? [];
  const dataLayer = w.dataLayer;
  // gtag.js 는 배열이 아니라 arguments 객체를 받는다(공식 설치 코드와 같게)
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params -- gtag.js 가 arguments 객체를 기대한다
    dataLayer.push(arguments);
  };
  const now = new Date();
  w.gtag("js", now);
  w.gtag("config", id, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  rememberGa4Id(id);
  appendScript(`https://www.googletagmanager.com/gtag/js?id=${id}`);
}

function loadPixel(id: string): void {
  const w = window as unknown as AnalyticsWindow;
  if (w.fbq) return;
  // 공식 설치 코드의 대기열과 같은 모양 — fbevents.js 가 오면 callMethod 를 채우고 queue 를 처리한다
  const enqueue = (...args: unknown[]): void => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  };
  const queue: unknown[][] = [];
  // 공식 코드처럼 push 도 같은 함수(fbevents.js 가 fbq.push 로 부르기도 한다)
  const fbq: PixelQueue = Object.assign(enqueue, {
    queue,
    loaded: true,
    version: "2.0",
    push: enqueue,
  });
  // 앱 안 화면 이동마다 PageView 를 저절로 보내지 않게 — 비밀이 있는 화면을 거르려고 우리가 직접 보낸다
  fbq.disablePushState = true;
  w.fbq = fbq;
  w._fbq = fbq;
  fbq("set", "autoConfig", false, id);
  fbq("init", id);
  appendScript("https://connect.facebook.net/en_US/fbevents.js");
}

function appendScript(src: string): void {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

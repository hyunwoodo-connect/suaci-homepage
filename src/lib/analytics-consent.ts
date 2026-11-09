"use client";

import { useSyncExternalStore } from "react";

/**
 * 방문 분석·광고 측정(GA4·메타 픽셀) 동의. 개인정보처리방침 6조 — 이 도구들은 방문자가 허용한 뒤에만 싣는다.
 * 고른 값은 이 브라우저에만 남는다(서버로 보내지 않는다). 언제 골랐는지 같이 남겨 방침이 바뀌면 다시 물을 수 있게 한다.
 */

/** 허용·거부 */
export type ConsentChoice = "granted" | "denied";

const CONSENT_KEY = "suaci.consent.analytics";
const CONSENT_EVENT = "suaci:consent";

/** 분석 도구가 남기는 쿠키 이름 — 동의를 거두면 지운다(GA4 `_ga`·`_ga_<ID>`·`_gid`·`_gat*`, 구글 광고 `_gcl_*`, 픽셀 `_fbp`·`_fbc`) */
const ANALYTICS_COOKIE = /^(_ga|_ga_[A-Z0-9]+|_gid|_gat\w*|_gcl_[a-z]+|_fbp|_fbc)$/;

/** 이 페이지에 실은 GA4 ID — 철회할 때 그 ID 의 측정을 끈다 */
const loadedGa4Ids = new Set<string>();

interface StoredConsent {
  choice: ConsentChoice;
  at: string;
}

/** 이 브라우저에 남은 선택. 고르지 않았거나 저장소를 못 쓰면 null */
export function readConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredConsent>;
    return stored.choice === "granted" || stored.choice === "denied" ? stored.choice : null;
  } catch {
    return null;
  }
}

/** 고른 값을 남기고 화면에 알린다 */
export function saveConsent(choice: ConsentChoice): void {
  try {
    const at = new Date().toISOString();
    const stored: StoredConsent = { choice, at };
    const serialized = JSON.stringify(stored);
    localStorage.setItem(CONSENT_KEY, serialized);
  } catch {
    // 저장소를 못 쓰는 브라우저 — 이 화면에서만 반영된다
  }
  notify();
}

/**
 * 다시 묻기(푸터 '쿠키 설정'). 실려 있는 도구를 먼저 멈추고(떠나는 순간 쿠키를 다시 쓰지 않게) 분석 쿠키를 지운 뒤,
 * 도구가 실려 있었으면 새로고침해 내린다(한 번 실린 스크립트는 페이지 안에서 떼어 낼 수 없다).
 */
export function resetConsent(): void {
  const wasLoaded = stopAnalyticsTools();
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    // 저장소를 못 쓰는 브라우저 — 지울 것도 없다
  }
  clearAnalyticsCookies();
  if (wasLoaded) {
    window.location.reload();
    return;
  }
  notify();
}

/**
 * 실려 있는 GA4·픽셀을 멈춘다 — 동의 철회(GA4 consent denied·측정 끄기, 픽셀 consent revoke). 실려 있었으면 true.
 * 다른 탭에서 동의를 거둔 경우에도 부른다.
 */
export function stopAnalyticsTools(): boolean {
  const { gtag, fbq } = window;
  if (gtag) {
    gtag("consent", "update", { analytics_storage: "denied", ad_storage: "denied" });
    for (const id of loadedGa4Ids) {
      (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = true;
    }
  }
  fbq?.("consent", "revoke");
  return Boolean(gtag || fbq);
}

/** 실은 GA4 ID 를 기억한다(철회 때 그 ID 의 측정을 끈다) */
export function rememberGa4Id(id: string): void {
  loadedGa4Ids.add(id);
}

/** 분석 쿠키를 이 주소와 모든 상위 도메인에서 지운다 — 철회할 때, 그리고 허용하지 않은 채 들어올 때 남은 것까지 */
export function clearAnalyticsCookies(): void {
  const names = document.cookie
    .split(";")
    .map((pair) => pair.split("=")[0]?.trim() ?? "")
    .filter((name) => ANALYTICS_COOKIE.test(name));
  if (names.length === 0) return;
  const labels = window.location.hostname.split(".");
  // a.b.takesuaci.com → .a.b.takesuaci.com · .b.takesuaci.com · .takesuaci.com (한 칸짜리 최상위는 브라우저가 거절한다)
  const domains = labels.slice(0, -1).map((_, i) => labels.slice(i).join("."));
  for (const name of names) {
    const expired = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    document.cookie = expired;
    for (const domain of domains) document.cookie = `${expired}; domain=.${domain}`;
  }
}

/** 동의 상태 — 서버 그림과 첫 그림에서는 undefined(아직 모름: 배너도 도구도 그리지 않는다) */
export function useAnalyticsConsent(): ConsentChoice | null | undefined {
  return useSyncExternalStore(subscribe, readConsent, () => undefined);
}

/* ─── 내부 ─────────────────────────── */

function notify(): void {
  const event = new Event(CONSENT_EVENT);
  window.dispatchEvent(event);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

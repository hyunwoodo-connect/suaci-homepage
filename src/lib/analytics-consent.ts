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

/** 분석 도구가 남기는 쿠키 이름 — 동의를 거두면 지운다(GA4 `_ga`·`_ga_<ID>`·`_gid`, 픽셀 `_fbp`·`_fbc`) */
const ANALYTICS_COOKIE = /^(_ga|_ga_[A-Z0-9]+|_gid|_gcl_au|_fbp|_fbc)$/;

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
 * 다시 묻기(푸터 '쿠키 설정'). 분석 쿠키를 지우고, 이미 허용해 도구가 실려 있었으면 새로고침해 내린다
 * (한 번 실린 스크립트는 페이지 안에서 떼어 낼 수 없다).
 */
export function resetConsent(): void {
  const wasGranted = readConsent() === "granted";
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    // 저장소를 못 쓰는 브라우저 — 지울 것도 없다
  }
  deleteAnalyticsCookies();
  if (wasGranted) {
    window.location.reload();
    return;
  }
  notify();
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

/** 분석 쿠키를 이 주소와 상위 도메인(.takesuaci.com) 양쪽에서 지운다 */
function deleteAnalyticsCookies(): void {
  const names = document.cookie
    .split(";")
    .map((pair) => pair.split("=")[0]?.trim() ?? "")
    .filter((name) => ANALYTICS_COOKIE.test(name));
  const host = window.location.hostname;
  const parentDomain = host.split(".").slice(-2).join(".");
  for (const name of names) {
    const expired = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    document.cookie = expired;
    document.cookie = `${expired}; domain=.${parentDomain}`;
  }
}

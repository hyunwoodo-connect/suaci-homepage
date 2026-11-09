"use client";

import { useEffect, useState } from "react";

import { useLocale } from "next-intl";

import { api } from "@/lib/api";
import type { SalesStatus } from "@/types";

/** 관리자 라이브 점검용 — `?buy=preview` 로 들어오면 이 탭에서는 버튼을 막지 않는다(서버가 허용 목록을 다시 본다) */
const PREVIEW_KEY = "suaci.sales.preview";

/** 한 페이지에 한 번만 묻는다(구매 바·시트·주문서가 같이 쓴다) */
let statusRead: Promise<SalesStatus | null> | undefined;

/** 판매 상태 — 못 읽으면 null(막지 않는다: 서버가 주문·결제 승인에서 다시 막는다) */
function readStatus(): Promise<SalesStatus | null> {
  statusRead ??= (async () => {
    try {
      return await api.getSalesStatus();
    } catch {
      return null;
    }
  })();
  return statusRead;
}

/** 이 탭이 관리자 점검 모드인가 — 주소의 `?buy=preview` 를 이 탭에 기억한다 */
function isPreview(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("buy") === "preview") sessionStorage.setItem(PREVIEW_KEY, "1");
    return sessionStorage.getItem(PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

/** 구매를 막을지 — 판매 전이고 점검 모드가 아니면. 받기 전에는 막지 않는다(지금 판매 중인 것이 기본) */
export interface SalesLock {
  locked: boolean;
  /** 판매 시작 날짜를 이 화면 언어로('1월 5일') — 시각을 모르면 없다 */
  opensOn?: string;
}

/** 출시 전 구매 차단 상태(#286) */
export function useSalesLock(): SalesLock {
  const locale = useLocale();
  const [lock, setLock] = useState<SalesLock>({ locked: false });
  useEffect(() => {
    let alive = true;
    void readStatus().then((status) => {
      if (!alive || !status || status.open || isPreview()) return;
      const opensOn =
        status.opensAt === undefined ? undefined : formatSalesDate(status.opensAt, locale);
      setLock({ locked: true, opensOn });
    });
    return () => {
      alive = false;
    };
  }, [locale]);
  return lock;
}

/** 판매 시작 날짜 — ko '1월 5일', ja '1月5日', en 'jan 5'(영문 카피는 소문자) */
export function formatSalesDate(opensAt: number, locale: string): string {
  const isEnglish = locale === "en";
  const month = isEnglish ? "short" : "long";
  const formatter = new Intl.DateTimeFormat(locale, {
    month,
    day: "numeric",
    timeZone: "Asia/Seoul",
  });
  const opensDate = new Date(opensAt);
  const text = formatter.format(opensDate);
  return isEnglish ? text.toLowerCase() : text;
}

/** 테스트용 — 한 페이지 캐시를 비운다 */
export function resetSalesStatusCache(): void {
  statusRead = undefined;
}

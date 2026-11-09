"use client";

import { saveConsent } from "@/lib/analytics-consent";

/** 동의 배너 문구 — [locale] 화면은 메시지(`consent.*`)에서, 이벤트 화면은 한국어로 넘긴다 */
export interface ConsentCopy {
  title: string;
  body: string;
  /** '자세히'를 펼치면 보이는 고지(목적·항목·받는 곳과 나라·이전 시기와 방법·보유 기간·거부해도 불이익 없음·철회 방법) */
  disclosures: string[];
  more: string;
  allow: string;
  decline: string;
  details: string;
}

interface ConsentBannerProps {
  copy: ConsentCopy;
  /** 개인정보처리방침 주소(언어 접두사 포함) */
  privacyHref: string;
}

/**
 * 방문 분석·광고 측정(행태정보 수집·국외 이전) 선택 동의. 고르기 전에는 도구를 싣지 않는다.
 * 동의에 꼭 알릴 것(개인정보 보호법 제15조 제2항·제28조의8 제2항)은 '자세히'에 모두 있다 — 첫 화면은 짧게.
 * 위쪽에 띄운다 — 아래는 구매 바가 있어 첫 화면에서 사는 길을 가리지 않게. 허용·거부는 같은 크기·같은 무게.
 */
export default function ConsentBanner({ copy, privacyHref }: ConsentBannerProps) {
  return (
    <div
      role="region"
      aria-label={copy.title}
      className="fixed inset-x-0 top-0 z-40 flex justify-center px-[8px] pt-[8px]"
    >
      <div className="flex max-h-[80vh] w-full max-w-[560px] flex-col gap-[10px] overflow-y-auto rounded-[16px] bg-paper px-[16px] py-[14px] text-[13px] leading-[1.6] text-ink shadow-[0_6px_24px_rgba(17,17,17,0.14)]">
        <p className="m-0 text-[14px] font-medium">{copy.title}</p>
        <p className="m-0">{copy.body}</p>
        <details className="group">
          <summary className="flex min-h-[32px] cursor-pointer items-center text-grey underline underline-offset-[3px]">
            {copy.more}
          </summary>
          <ul className="m-0 mt-[6px] flex list-none flex-col gap-[4px] p-0 text-[12px] text-grey">
            {copy.disclosures.map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>
              <a href={privacyHref} className="underline underline-offset-[3px]">
                {copy.details}
              </a>
            </li>
          </ul>
        </details>
        <div className="flex gap-[8px]">
          <button
            type="button"
            onClick={() => {
              saveConsent("denied");
            }}
            className="h-[44px] flex-1 cursor-pointer rounded-full border border-line px-[18px] text-[14px] font-medium"
          >
            {copy.decline}
          </button>
          <button
            type="button"
            onClick={() => {
              saveConsent("granted");
            }}
            className="h-[44px] flex-1 cursor-pointer rounded-full border border-line px-[18px] text-[14px] font-medium"
          >
            {copy.allow}
          </button>
        </div>
      </div>
    </div>
  );
}

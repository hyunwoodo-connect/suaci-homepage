"use client";

import { saveConsent } from "@/lib/analytics-consent";

/** 동의 배너 문구 — [locale] 화면은 메시지(`consent.*`)에서, 이벤트 화면은 한국어로 넘긴다 */
export interface ConsentCopy {
  body: string;
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
 * 방문 분석·광고 측정 쿠키를 물어보는 띠. 고르기 전에는 도구를 싣지 않는다.
 * 위쪽에 띄운다 — 아래는 구매 바가 있어 첫 화면에서 사는 길을 가리지 않게. 허용·거부는 같은 무게(한쪽으로 몰지 않는다).
 */
export default function ConsentBanner({ copy, privacyHref }: ConsentBannerProps) {
  return (
    <div
      role="region"
      aria-label={copy.details}
      className="fixed inset-x-0 top-0 z-40 flex justify-center px-[8px] pt-[8px]"
    >
      <div className="flex w-full max-w-[560px] flex-col gap-[10px] rounded-[16px] bg-paper px-[16px] py-[14px] text-[13px] leading-[1.6] text-ink shadow-[0_6px_24px_rgba(17,17,17,0.14)] sm:flex-row sm:items-center sm:gap-[16px]">
        <p className="m-0 flex-1">
          {copy.body}{" "}
          <a href={privacyHref} className="text-grey underline underline-offset-[3px]">
            {copy.details}
          </a>
        </p>
        <div className="flex shrink-0 gap-[8px]">
          <button
            type="button"
            onClick={() => {
              saveConsent("denied");
            }}
            className="h-[44px] flex-1 cursor-pointer rounded-full border border-line px-[18px] text-[14px] font-medium sm:flex-none"
          >
            {copy.decline}
          </button>
          <button
            type="button"
            onClick={() => {
              saveConsent("granted");
            }}
            className="h-[44px] flex-1 cursor-pointer rounded-full border border-ink px-[18px] text-[14px] font-medium sm:flex-none"
          >
            {copy.allow}
          </button>
        </div>
      </div>
    </div>
  );
}

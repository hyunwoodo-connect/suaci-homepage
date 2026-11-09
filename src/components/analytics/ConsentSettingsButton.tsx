"use client";

import { resetConsent } from "@/lib/analytics-consent";

interface ConsentSettingsButtonProps {
  label: string;
  className?: string;
}

/** 푸터 '쿠키 설정' — 고른 값을 지우고 다시 묻는다(허용했었다면 새로고침해 도구를 내린다) */
export default function ConsentSettingsButton({ label, className }: ConsentSettingsButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        resetConsent();
      }}
      className={`cursor-pointer ${className ?? ""}`}
    >
      {label}
    </button>
  );
}

"use client";

import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";

import { PRODUCT } from "@/constants/product";
import { readPendingOrder, type PendingOrder } from "@/lib/payment/pending";

interface ResumePromptProps {
  /** 이어서 열 수량 — 보류 주문의 수량 */
  onResume: (qty: number) => void;
}

/**
 * 구매 바 바로 위 '이어서' 한 줄 — 결제하지 않은 보류 주문(30분)이 있으면 그 수량으로 시트를 연다.
 * 결정 9: 발송 알림은 없다 — 화면 한 줄뿐. 엄지 자리(바 옆)에 둬서 누르면 바로 이어진다.
 */
export default function ResumePrompt({ onResume }: ResumePromptProps) {
  const t = useTranslations("pay.bar");
  const [pending, setPending] = useState<PendingOrder | null>(null);

  useEffect(() => {
    // setState 는 .then 안에서(react-hooks 린트)
    Promise.resolve().then(() => {
      setPending(readPendingOrder());
    });
  }, []);

  if (!pending) return null;

  const qty = Math.min(pending.qty, PRODUCT.maxQuantity);
  return (
    <p className="pointer-events-auto m-0 flex items-center gap-[4px] rounded-full bg-paper py-[0] pl-[16px] pr-[4px] text-[13px] text-ink shadow-[0_2px_10px_rgba(20,20,20,0.10)]">
      <span>{t("resume")}</span>
      <button
        type="button"
        onClick={() => {
          onResume(qty);
        }}
        className="flex h-[44px] cursor-pointer items-center px-[12px] font-medium underline underline-offset-[3px]"
      >
        {t("resumeCta")}
      </button>
    </p>
  );
}

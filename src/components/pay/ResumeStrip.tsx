"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart/cart-context";
import { readPendingOrder } from "@/lib/payment/pending";

interface ResumeStripProps {
  onResume: () => void;
}

/**
 * 홈 상단 이어가기 띠 — 보류 주문(30분)이 있으면 이어서, 없고 카트에 담긴 게 있으면 한 줄 안내.
 * 결정 9: 발송 알림은 없다 — 화면 한 줄뿐.
 */
export default function ResumeStrip({ onResume }: ResumeStripProps) {
  const t = useTranslations("pay.bar");
  const { cart } = useCart();
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    // setState 는 .then 안에서(react-hooks 린트)
    Promise.resolve().then(() => {
      setHasPending(readPendingOrder() !== null);
    });
  }, []);

  const kept = (cart?.items.length ?? 0) > 0;
  if (!hasPending && !kept) return null;

  return (
    <div className="sticky top-0 z-20 flex items-center justify-center gap-[12px] border-b border-line bg-paper/95 px-[16px] py-[10px] text-[13px] backdrop-blur">
      {hasPending ? (
        <>
          <span>{t("resume")}</span>
          <button
            type="button"
            onClick={onResume}
            className="cursor-pointer font-medium underline underline-offset-[3px]"
          >
            {t("resumeCta")}
          </button>
        </>
      ) : (
        <span>{t("kept_note")}</span>
      )}
    </div>
  );
}

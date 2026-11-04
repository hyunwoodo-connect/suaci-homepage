"use client";

import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import PayResult from "@/components/pay/PayResult";
import ButtonLink from "@/components/ui/ButtonLink";
import { readPendingOrder } from "@/lib/payment/pending";

/**
 * 결제 실패·중단 복귀 — 보류 주문(sessionStorage)은 지우지 않는다.
 * 30분 안에 /checkout 으로 돌아가면 같은 멱등키로 이어서 결제한다(결정 12).
 */
export default function PayFailPage() {
  return (
    <Suspense>
      <PayFailBody />
    </Suspense>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function PayFailBody() {
  const t = useTranslations("pay.result");
  const [qty, setQty] = useState<number | null>(null);
  useEffect(() => {
    Promise.resolve().then(() => {
      setQty(readPendingOrder()?.qty ?? null);
    });
  }, []);
  return (
    <PayResult message={t("stopped")}>
      <ButtonLink href={qty ? `/checkout?qty=${String(qty)}` : "/checkout"}>
        {t("continue")}
      </ButtonLink>
    </PayResult>
  );
}

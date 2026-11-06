"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import PayResult from "@/components/pay/PayResult";
import ButtonLink from "@/components/ui/ButtonLink";
import { failReason } from "@/lib/payment/fail-reason";
import { readPendingOrder } from "@/lib/payment/pending";

/**
 * 결제 실패·중단 복귀 — 토스가 실패 주소에 붙인 code·message 로 사유를 나눠 보여 준다.
 * 보류 주문(sessionStorage)은 지우지 않는다. 30분 안에 다시 결제하면 같은 멱등키로 잇는다(결정 12).
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
  const search = useSearchParams();
  const reason = failReason(search.get("code"), search.get("message"));
  const [qty, setQty] = useState<number | null>(null);
  useEffect(() => {
    Promise.resolve().then(() => {
      setQty(readPendingOrder()?.qty ?? null);
    });
  }, []);
  return (
    <PayResult
      message={
        reason.kind === "canceled"
          ? t("canceled")
          : t("failed", { reason: reason.message ? `${reason.message} ` : "" })
      }
    >
      <ButtonLink href={qty ? `/checkout?qty=${String(qty)}` : "/checkout"}>
        {t("continue")}
      </ButtonLink>
    </PayResult>
  );
}

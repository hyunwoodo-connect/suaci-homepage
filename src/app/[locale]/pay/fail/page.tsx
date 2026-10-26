"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

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
  return (
    <main>
      <div className="mx-auto flex min-h-[60vh] max-w-[480px] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm">{t("stopped")}</p>
        <Link href="/checkout" className="text-sm underline">
          {t("continue")}
        </Link>
      </div>
    </main>
  );
}

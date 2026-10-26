"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { ApiClientError } from "@/lib/api/errors";
import { useCart } from "@/lib/cart/cart-context";
import { clearPendingOrder, readPendingOrder } from "@/lib/payment/pending";
import { parsePaymentReturn } from "@/lib/payment/providers";

/**
 * 결제 성공 복귀 — 결제창(또는 목업)이 paymentKey·orderId·amount 를 들고 오는 곳.
 * 금액은 쿼리 그대로 승인에 보낸다 — 변조면 서버가 PAYMENT_AMOUNT_MISMATCH 로 거절한다(스펙 §4).
 */
export default function PayCompletePage() {
  return (
    <Suspense>
      <PayCompleteBody />
    </Suspense>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

type Phase = "confirming" | "badLink" | "declined" | "hiccup";

function PayCompleteBody() {
  const t = useTranslations("pay.result");
  const router = useRouter();
  const search = useSearchParams();
  const { refresh } = useCart();
  const [phase, setPhase] = useState<Phase>("confirming");
  const [pendingQty, setPendingQty] = useState<number | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      setPendingQty(readPendingOrder()?.qty ?? null);
    });
  }, []);

  const orderId = search.get("o");
  const parsed = parsePaymentReturn(search);
  const first = search.get("first") === "1";

  const confirm = useCallback(async () => {
    if (!orderId || !parsed) return;
    setPhase("confirming");
    try {
      await api.confirmPayment(orderId, { paymentKey: parsed.paymentKey, amount: parsed.amount });
      clearPendingOrder();
      void refresh().catch(() => {});
      router.replace(`/orders/${orderId}?welcome=1${first ? "&first=1" : ""}`);
    } catch (err) {
      setPhase(
        err instanceof ApiClientError && err.code === "PAYMENT_DECLINED" ? "declined" : "hiccup",
      );
    }
  }, [first, orderId, parsed, refresh, router]);

  useEffect(() => {
    // StrictMode 이중 마운트에도 승인은 1회(서버도 멱등이지만 요청을 아낀다)
    if (ran.current) return;
    ran.current = true;
    Promise.resolve().then(() => {
      if (!orderId || !parsed) {
        setPhase("badLink");
        return;
      }
      void confirm();
    });
  }, [confirm, orderId, parsed]);

  return (
    <main>
      <div className="mx-auto flex min-h-[60vh] max-w-[480px] flex-col items-center justify-center gap-4 px-4 text-center">
        {phase === "confirming" && <p className="text-sm text-grey">{t("confirming")}</p>}
        {phase === "badLink" && (
          <>
            <p className="text-sm">{t("badLink")}</p>
            <Link href="/" className="text-sm underline">
              {t("home")}
            </Link>
          </>
        )}
        {phase === "declined" && (
          <>
            <p className="text-sm">{t("declined")}</p>
            <Link
              href={pendingQty ? `/checkout?qty=${String(pendingQty)}` : "/checkout"}
              className="text-sm underline"
            >
              {t("backToCheckout")}
            </Link>
          </>
        )}
        {phase === "hiccup" && (
          <>
            <p className="text-sm">{t("hiccup")}</p>
            <button
              type="button"
              onClick={() => {
                void confirm();
              }}
              className="cursor-pointer text-sm underline"
            >
              {t("retry")}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

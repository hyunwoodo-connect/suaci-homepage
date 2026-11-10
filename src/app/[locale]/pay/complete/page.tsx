"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { useRouter } from "@/i18n/navigation";
import PayResult from "@/components/pay/PayResult";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import { api, ApiClientError } from "@/lib/api";
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

type Phase =
  | "confirming"
  | "badLink"
  | "declined"
  | "expired"
  | "hiccup"
  | "refundedOutOfStock"
  | "refundedClosed"
  | "salesNotOpen";

/**
 * 서버가 결제를 확정하지 않고 닫은 승인 실패 → 다시 확인해도 소용없다. 결제된 돈이 있으면 서버가 이미 취소·환불했다
 * (재고 부족 자동 환불·닫힌 주문·금액 불일치). 확인 전에 거절한 경우는 돈이 움직이지 않았다
 */
const CLOSED_BY_SERVER: Readonly<Record<string, Phase>> = {
  OUT_OF_STOCK: "refundedOutOfStock",
  ORDER_NOT_PAYABLE: "refundedClosed",
  PAYMENT_AMOUNT_MISMATCH: "refundedClosed",
  // 출시 전 구매 차단 — 서버가 토스 승인을 부르지 않았다(돈이 안 나갔다). 판매가 열리면 새로 주문한다
  SALES_NOT_OPEN: "salesNotOpen",
};

/**
 * 승인되지 않아 같은 결제로 다시 확인해도 소용없는 실패 — 결제창을 새로 연다(같은 보류 주문). 돈은 나가지 않았다.
 * 카드사·은행 거절이면 다른 수단으로, 결제창 인증(10분)이 지났으면 다시 결제. 일시 오류는 여기 없다(같은 결제로 '다시 확인')
 */
const RETRY_WITH_NEW_PAYMENT: Readonly<Record<string, Phase>> = {
  PAYMENT_DECLINED: "declined",
  PAYMENT_SESSION_EXPIRED: "expired",
};

function PayCompleteBody() {
  const t = useTranslations("pay.result");
  const tBar = useTranslations("pay.bar");
  const router = useRouter();
  const search = useSearchParams();
  const [phase, setPhase] = useState<Phase>("confirming");
  const [pendingQty, setPendingQty] = useState<number | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      const savedQty = readPendingOrder()?.qty ?? null;
      setPendingQty(savedQty);
    });
  }, []);

  const orderId = search.get("o");
  const parsed = parsePaymentReturn(search);

  const confirm = useCallback(async () => {
    if (!orderId || !parsed) return;
    setPhase("confirming");
    try {
      await api.confirmPayment(orderId, { paymentKey: parsed.paymentKey, amount: parsed.amount });
      clearPendingOrder();
      router.replace(`/orders/${orderId}?welcome=1`);
    } catch (err) {
      const code = err instanceof ApiClientError ? err.code : "";
      const closed = CLOSED_BY_SERVER[code];
      // 닫힌 주문을 '이어서 결제하기'로 다시 열지 않게 보류 기록을 지운다
      if (closed) clearPendingOrder();
      // ORDER_NOT_PAYABLE 은 '결제 전이 아님' 전부다 — 이미 결제된 주문(다른 탭·새로고침)이면 닫힌 게 아니라 끝난 것
      if (code === "ORDER_NOT_PAYABLE" && (await isAlreadyPaid(orderId))) {
        router.replace(`/orders/${orderId}`);
        return;
      }
      const failedPhase = closed ?? RETRY_WITH_NEW_PAYMENT[code] ?? "hiccup";
      setPhase(failedPhase);
    }
  }, [orderId, parsed, router]);

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

  if (phase === "badLink") {
    return (
      <PayResult message={t("badLink")}>
        <ButtonLink href="/">{t("home")}</ButtonLink>
      </PayResult>
    );
  }
  if (phase === "declined" || phase === "expired") {
    const checkoutHref = pendingQty ? `/checkout?qty=${String(pendingQty)}` : "/checkout";
    const buttonLabel = phase === "declined" ? t("backToCheckout") : t("continue");
    return (
      <PayResult message={t(phase)}>
        <ButtonLink href={checkoutHref}>{buttonLabel}</ButtonLink>
      </PayResult>
    );
  }
  if (phase === "refundedOutOfStock" || phase === "refundedClosed") {
    return (
      <PayResult message={t(phase)}>
        {/* 주문이 어떻게 닫혔는지(취소·환불) 그 주문에서 확인한다 */}
        <ButtonLink href={orderId ? `/orders/${orderId}` : "/orders"}>
          {t("orderDetail")}
        </ButtonLink>
        <ButtonLink href="/" variant="secondary">
          {t("home")}
        </ButtonLink>
      </PayResult>
    );
  }
  if (phase === "salesNotOpen") {
    return (
      <PayResult message={t("salesNotOpen")}>
        <ButtonLink href="/notify">{tBar("notify")}</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          {t("home")}
        </ButtonLink>
      </PayResult>
    );
  }
  if (phase === "hiccup") {
    return (
      <PayResult message={t("hiccup")}>
        <Button
          onClick={() => {
            void confirm();
          }}
        >
          {t("retry")}
        </Button>
        {/* 카드에서 돈이 빠졌을 수 있는 상태라 막다른 길이 되지 않게 주문 내역으로 가는 길을 둔다 */}
        <ButtonLink href="/orders" variant="secondary">
          {t("orders")}
        </ButtonLink>
      </PayResult>
    );
  }
  return <PayResult message={t("confirming")} />;
}

/* ─── 내부 ─────────────────────────── */

/** 주문이 이미 결제됐나(결제완료·부분 환불). 못 읽으면 아니라고 본다 — 닫혔다는 안내와 주문 링크가 남는다 */
async function isAlreadyPaid(orderId: string): Promise<boolean> {
  try {
    const order = await api.getOrder(orderId);
    return order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded";
  } catch {
    return false;
  }
}

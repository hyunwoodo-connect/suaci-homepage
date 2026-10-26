"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { displayTotal } from "@/constants/checkout";
import { PRODUCT } from "@/constants/product";
import LoginSheet from "@/components/pay/LoginSheet";
import ReBuySheet from "@/components/pay/ReBuySheet";
import ResumeStrip from "@/components/pay/ResumeStrip";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { useCart } from "@/lib/cart/cart-context";
import { formatKRW } from "@/lib/format";
import type { CheckoutDefaults } from "@/types";

/**
 * v5 하단 사기 바 — 사이트의 유일한 구매 CTA. "쿠팡처럼 두 번 클릭이면 구매 끝"(오너 #93).
 * 수량은 바에서 고르고, 사기 = (로그인 시트 →) 재구매 시트 → 결제창. 기본 배송지가 없으면 주문서로.
 */
export default function BuyBar() {
  const t = useTranslations("pay.bar");
  const router = useRouter();
  const search = useSearchParams();
  const { status } = useAuth();
  const { add } = useCart();

  const [qty, setQty] = useState(1);
  const [sheet, setSheet] = useState<"login" | CheckoutDefaults | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);

  const total = displayTotal(qty);

  const buy = useCallback(async () => {
    if (busy) return;
    if (status !== "authenticated") {
      setSheet("login");
      return;
    }
    setBusy(true);
    try {
      const defaults = await api.getCheckoutDefaults();
      if (!defaults.address) {
        router.push(`/checkout?qty=${String(qty)}&first=1`);
        return;
      }
      setSheet(defaults);
    } catch {
      // defaults 를 못 읽어도 구매는 막지 않는다 — 주문서에서 고르면 된다
      router.push(`/checkout?qty=${String(qty)}&first=1`);
    } finally {
      setBusy(false);
    }
  }, [busy, qty, router, status]);

  // 로그인에서 ?buy=1 로 돌아오면 시트를 이어서 연다
  useEffect(() => {
    if (autoOpened || status === "loading" || search.get("buy") !== "1") return;
    setAutoOpened(true);
    void buy();
  }, [autoOpened, buy, search, status]);

  const keep = async () => {
    if (status !== "authenticated") {
      setSheet("login");
      return;
    }
    try {
      await add({ productId: PRODUCT.productId, variantId: PRODUCT.variantId, quantity: qty });
      setNote(t("kept"));
    } catch {
      setNote(null);
    }
  };

  return (
    <>
      <ResumeStrip
        onResume={() => {
          void buy();
        }}
      />
      {/* 바 높이(66+16px)만큼 끌어올려 푸터 아래에 빈 띠가 생기지 않게 한다. */}
      <div className="pointer-events-none sticky bottom-0 z-20 -mt-[82px] flex flex-col items-center gap-[6px] px-[16px] pb-[16px]">
        <p className="pointer-events-none m-0 text-[11px] text-grey">
          {note ?? t("shippingIncluded")}
        </p>
        <div className="pointer-events-auto flex h-[52px] items-center gap-[10px] rounded-full bg-ink pl-[10px] pr-[8px] text-paper shadow-[0_6px_24px_rgba(17,17,17,0.18)]">
          <div
            role="group"
            aria-label={t("buy")}
            className="flex items-center rounded-full border border-paper/25"
          >
            <button
              type="button"
              aria-label={t("decrease")}
              disabled={qty <= 1}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="h-[36px] w-[34px] cursor-pointer text-[16px] disabled:opacity-30"
            >
              −
            </button>
            <span className="num w-[20px] text-center text-[14px] font-medium" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              aria-label={t("increase")}
              disabled={qty >= PRODUCT.maxQuantity}
              onClick={() => setQty((q) => Math.min(PRODUCT.maxQuantity, q + 1))}
              className="h-[36px] w-[34px] cursor-pointer text-[16px] disabled:opacity-30"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              void buy();
            }}
            aria-haspopup="dialog"
            className="flex h-[40px] cursor-pointer items-center gap-[8px] rounded-full bg-paper px-[18px] text-[14px] font-semibold text-ink"
          >
            <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-lime" />
            <span className="num">
              {formatKRW(total)} · {t("buy")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              void keep();
            }}
            className="cursor-pointer pr-[10px] text-[12px] text-paper/70 underline underline-offset-[3px] hover:text-paper"
          >
            {t("keep")}
          </button>
        </div>
      </div>
      {sheet === "login" && (
        <LoginSheet
          next="/?buy=1"
          onClose={() => {
            setSheet(null);
          }}
        />
      )}
      {sheet !== null && sheet !== "login" && (
        <ReBuySheet
          qty={qty}
          defaults={sheet}
          onClose={() => {
            setSheet(null);
          }}
        />
      )}
    </>
  );
}

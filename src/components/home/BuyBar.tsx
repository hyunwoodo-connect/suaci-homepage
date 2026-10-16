"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PRODUCT } from "@/constants/product";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { useCart } from "@/lib/cart/cart-context";
import { formatKRW } from "@/lib/format";

type PayMethod = "applePay" | "googlePay" | "card";

/**
 * v5 하단 원클릭 바 — 사이트의 유일한 구매 CTA.
 * 누르면 구매 시트(모바일: 바텀시트 / 데스크톱: 우측 패널)가 열린다.
 *
 * 결제는 seam(mock) 계약을 그대로 쓴다: 장바구니 1라인 → createOrder → confirmPayment.
 * TODO(배포): apple pay / google pay는 Stripe Payment Request로 교체.
 * TODO(백엔드): 게스트 주문(로그인·주소 없이) 계약이 생기면 로그인 게이트 제거.
 */
export default function BuyBar() {
  const t = useTranslations("home.buy");
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      {/* 바 높이(52+16px)만큼 끌어올려 푸터 아래에 빈 띠가 생기지 않게 한다. */}
      <div className="pointer-events-none sticky bottom-0 z-20 -mt-[68px] flex justify-center px-[16px] pb-[16px]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={t("open")}
          className="pointer-events-auto flex h-[52px] cursor-pointer items-center gap-[16px] rounded-full bg-ink pl-[20px] pr-[8px] text-paper shadow-[0_6px_24px_rgba(17,17,17,0.18)]"
        >
          <span className="num text-[14px] font-medium">
            {PRODUCT.name} · {formatKRW(PRODUCT.price)}
          </span>
          <span className="flex h-[40px] items-center gap-[8px] rounded-full bg-paper px-[18px] text-[14px] font-semibold text-ink">
            <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-lime" />
            {t("bar")}
          </span>
        </button>
      </div>
      {open && <BuySheet onClose={close} />}
    </>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function BuySheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("home.buy");
  const router = useRouter();
  const { status } = useAuth();
  const { clear, add, refresh } = useCart();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState<PayMethod | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(true);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const total = PRODUCT.price * qty;

  const pay = async (method: PayMethod) => {
    if (busy) return;
    if (status !== "authenticated") {
      router.push("/login?next=/");
      return;
    }
    setBusy(method);
    setNote(null);
    try {
      await clear();
      await add({ productId: PRODUCT.productId, variantId: PRODUCT.variantId, quantity: qty });
      const addresses = await api.listAddresses();
      const address = addresses.find((a) => a.isDefault) ?? addresses[0];
      // 카드 결제나 배송지가 없으면 체크아웃에서 배송지를 고른다.
      if (method === "card" || !address) {
        router.push("/checkout");
        return;
      }
      const order = await api.createOrder({
        addressId: address.addressId,
        idempotencyKey: crypto.randomUUID(),
      });
      // TODO(배포): Stripe 결제 성공 응답의 키로 교체
      await api.confirmPayment(order.orderId, {
        paymentKey: `mockpay_${order.orderId}`,
        amount: order.totals.grandTotal,
      });
      await refresh();
      router.push(`/orders/${order.orderId}?welcome=1`);
    } catch {
      setNote(t("error"));
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/30"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="buy-title"
        tabIndex={-1}
        className="relative flex w-full max-w-[480px] flex-col gap-[20px] rounded-t-[20px] bg-paper px-[20px] pb-[28px] pt-[12px] outline-none md:max-w-[420px] md:rounded-none md:px-[32px] md:pt-[32px]"
      >
        <span aria-hidden="true" className="mx-auto h-[4px] w-[36px] rounded-full bg-line md:hidden" />
        <div className="flex items-center justify-between">
          <h2 id="buy-title" className="m-0 text-[16px] font-medium">{t("title")}</h2>
          <button type="button" onClick={onClose} className="cursor-pointer text-[13px] text-grey hover:text-ink">
            {t("close")}
          </button>
        </div>

        <div className="flex items-center gap-[16px]">
          <div className="flex-1">
            <p className="m-0 text-[15px]">{PRODUCT.name}</p>
            <p className="num m-0 text-[13px] text-grey">
              {PRODUCT.volume} · {formatKRW(PRODUCT.price)}
            </p>
          </div>
          <div role="group" aria-label={t("quantity")} className="flex items-center rounded-full border border-line">
            <button
              type="button"
              aria-label={t("decrease")}
              disabled={qty <= 1}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="h-[36px] w-[36px] cursor-pointer text-[16px] disabled:opacity-30"
            >
              −
            </button>
            <span className="num w-[24px] text-center text-[15px] font-medium" aria-live="polite">{qty}</span>
            <button
              type="button"
              aria-label={t("increase")}
              disabled={qty >= PRODUCT.maxQuantity}
              onClick={() => setQty((q) => Math.min(PRODUCT.maxQuantity, q + 1))}
              className="h-[36px] w-[36px] cursor-pointer text-[16px] disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-[8px] border-y border-line py-[16px] text-[14px]">
          <Row label={t("subtotal")} value={formatKRW(total)} />
          <Row label={t("shipping")} value={t("shippingNote")} muted />
          <div className="flex justify-between pt-[4px] text-[16px] font-semibold">
            <span>{t("total")}</span>
            <span className="num">{formatKRW(total)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-[10px]">
          <PayButton onClick={() => pay("applePay")} busy={busy === "applePay"} label={t("applePay")} busyLabel={t("processing")} dark />
          <PayButton onClick={() => pay("googlePay")} busy={busy === "googlePay"} label={t("googlePay")} busyLabel={t("processing")} />
          <button
            type="button"
            onClick={() => pay("card")}
            className="cursor-pointer py-[6px] text-[13px] text-grey underline underline-offset-[3px] hover:text-ink"
          >
            {t("card")}
          </button>
        </div>

        {note && <p role="status" className="m-0 text-[13px] text-ink">{note}</p>}
        {status !== "authenticated" && !note && (
          <p className="m-0 text-center text-[12px] text-grey">{t("signInHint")}</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-grey">{label}</span>
      <span className={`num ${muted ? "text-grey" : ""}`}>{value}</span>
    </div>
  );
}

interface PayButtonProps {
  onClick: () => void;
  busy: boolean;
  label: string;
  busyLabel: string;
  dark?: boolean;
}

function PayButton({ onClick, busy, label, busyLabel, dark = false }: PayButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`h-[52px] cursor-pointer rounded-full text-[15px] font-medium transition-opacity disabled:opacity-60 ${
        dark ? "bg-ink text-paper" : "border border-line bg-paper text-ink"
      }`}
    >
      {busy ? busyLabel : label}
    </button>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import PageShell from "@/components/shell/PageShell";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { useCart } from "@/lib/cart/cart-context";
import { formatKRW } from "@/lib/format";
import type { Address } from "@/types";

/** 무료배송 임계 — 서버 totals가 최종 권위, 여긴 안내 문구용. */
const FREE_SHIPPING_OVER = 50000;

/** 처리 가능한 주문 에러 코드 → 메시지 키. 그 외는 GENERIC. */
const KNOWN_ERROR_CODES = [
  "EMPTY_CART",
  "ADDRESS_NOT_FOUND",
  "PAYMENT_AMOUNT_MISMATCH",
  "OUT_OF_STOCK",
  "AUTH_REQUIRED",
] as const;

/**
 * 체크아웃 — 로그인 필수. 배송지 선택 → 주문 요약 → 주문/결제(mock).
 * createOrder → confirmPayment(mockpay) → 주문 상세로 이동.
 * 모바일 우선: 단일 컬럼 스택(배송지 → 요약 → CTA).
 */
export default function CheckoutPage() {
  const t = useTranslations("checkout");
  const router = useRouter();
  const { status } = useAuth();
  const { cart, refresh } = useCart();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrLoaded, setAddrLoaded] = useState(false);
  // 사용자가 명시적으로 고른 배송지. null이면 기본 배송지로 폴백(아래 selectedId).
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // 로그인 게이트 — 미인증이면 로그인으로 리다이렉트(복귀 경로 포함).
  useEffect(() => {
    if (status === "anonymous") router.replace("/login?next=/checkout");
  }, [status, router]);

  const refreshAddresses = useCallback(() => {
    void api
      .listAddresses()
      .then((list) => {
        setAddresses(list);
        setAddrLoaded(true);
      })
      .catch(() => setAddrLoaded(true));
  }, []);

  useEffect(() => {
    if (status === "authenticated") refreshAddresses();
  }, [status, refreshAddresses]);

  // 선택된 배송지 = 사용자 선택 ?? 기본 배송지 ?? 첫 번째. (state 파생, effect 불필요)
  const defaultId = (addresses.find((a) => a.isDefault) ?? addresses[0])?.addressId ?? null;
  const selectedId =
    overrideId && addresses.some((a) => a.addressId === overrideId) ? overrideId : defaultId;

  // 로그인 상태 확인 중 — 스피너 대체(마이크로 로딩 라벨).
  if (status === "loading") {
    return (
      <PageShell no="CO" title={<>Check <em>out</em></>} meta="">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey">…</p>
      </PageShell>
    );
  }

  // 리다이렉트 진행 중(anonymous) — 깜빡임 방지용 빈 셸.
  if (status !== "authenticated") {
    return (
      <PageShell no="CO" title={<>Check <em>out</em></>} meta="">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey">…</p>
      </PageShell>
    );
  }

  const items = cart?.items ?? [];

  // 장바구니 비어 있음.
  if (items.length === 0) {
    return (
      <PageShell no="CO" title={<>Check <em>out</em></>} meta={t("meta")}>
        <div className="flex flex-col items-start gap-[16px] max-w-[860px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey m-0">
            {t("emptyCart")}
          </p>
          <Link
            href="/products"
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline underline-offset-[3px] hover:text-acid-deep"
          >
            {t("continueShopping")} →
          </Link>
        </div>
      </PageShell>
    );
  }

  const selected = addresses.find((a) => a.addressId === selectedId) ?? null;

  const placeOrder = async () => {
    if (busy) return; // 이중 제출 가드
    if (!selected) {
      setNote(t("selectAddress"));
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const order = await api.createOrder({ addressId: selected.addressId, idempotencyKey });
      // TODO(배포): 토스 결제위젯으로 교체 — paymentKey는 위젯 결제 성공 응답에서
      await api.confirmPayment(order.orderId, {
        paymentKey: `mockpay_${order.orderId}`,
        amount: order.totals.grandTotal,
      });
      await refresh();
      router.push(`/orders/${order.orderId}?welcome=1`);
    } catch (e) {
      if (e instanceof ApiClientError) {
        const known = (KNOWN_ERROR_CODES as readonly string[]).includes(e.code);
        setNote(known ? t(`error.${e.code}`) : t("error.GENERIC"));
        if (e.code === "AUTH_REQUIRED") router.replace("/login?next=/checkout");
      } else {
        setNote(t("error.GENERIC"));
      }
      setBusy(false); // 성공 시엔 이동하므로 리셋 불필요
    }
  };

  const totals = cart?.totals;
  const subtotal = totals?.itemsSubtotal ?? 0;
  const discount = totals?.discountTotal ?? 0;
  const freeShipping = subtotal >= FREE_SHIPPING_OVER;

  return (
    <PageShell no="CO" title={<>Check <em>out</em></>} meta={t("meta")}>
      <div className="max-w-[860px] flex flex-col gap-[36px]">
        {/* ── 배송지 ── */}
        <section>
          <SectionLabel>{t("addressTitle")}</SectionLabel>

          {!addrLoaded ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey m-0">…</p>
          ) : addresses.length === 0 ? (
            <div className="flex flex-col items-start gap-[14px] border-[1.5px] border-ink p-[16px]">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey m-0">
                {t("noAddress")}
              </p>
              <Link
                href="/account/addresses"
                className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline underline-offset-[3px] hover:text-acid-deep"
              >
                {t("addAddress")} →
              </Link>
            </div>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-[12px]">
              {addresses.map((a) => {
                const active = a.addressId === selectedId;
                return (
                  <li key={a.addressId}>
                    <button
                      type="button"
                      onClick={() => setOverrideId(a.addressId)}
                      aria-pressed={active}
                      className={`w-full text-left border-[1.5px] border-ink p-[16px] cursor-pointer transition-colors ${
                        active ? "bg-ink text-paper" : "bg-transparent text-ink hover:bg-[#f0f0ea]"
                      }`}
                    >
                      <div className="flex items-center gap-[10px] mb-[8px]">
                        <span
                          aria-hidden
                          className={`inline-block w-[12px] h-[12px] border-[1.5px] ${
                            active ? "border-acid bg-acid" : "border-ink"
                          }`}
                        />
                        <b className="font-display text-[15px]">{a.recipient}</b>
                        {a.label && (
                          <span
                            className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
                              active ? "text-paper/70" : "text-grey"
                            }`}
                          >
                            {a.label}
                          </span>
                        )}
                        {a.isDefault && (
                          <span
                            className={`font-mono text-[10px] uppercase tracking-[0.1em] px-[7px] py-[2px] ${
                              active ? "bg-acid text-ink" : "bg-ink text-acid"
                            }`}
                          >
                            {t("defaultBadge")}
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-[13.5px] m-0 leading-[1.6] ${
                          active ? "text-paper/90" : "text-ink-soft"
                        }`}
                      >
                        ({a.zipcode}) {a.addr1} {a.addr2 ?? ""}
                        <br />
                        {a.phone}
                      </p>
                    </button>
                  </li>
                );
              })}
              <li>
                <Link
                  href="/account/addresses"
                  className="inline-block mt-[2px] font-mono text-[11px] uppercase tracking-[0.08em] text-grey hover:text-ink"
                >
                  + {t("addAddress")}
                </Link>
              </li>
            </ul>
          )}
        </section>

        {/* ── 주문 요약 ── */}
        <section>
          <SectionLabel>{t("summaryTitle")}</SectionLabel>

          <ul className="list-none m-0 p-0 border-[1.5px] border-ink mb-[16px]">
            {items.map((line) => (
              <li
                key={line.variantId}
                className="flex items-center gap-[16px] px-[16px] py-[13px] border-b-[1.5px] border-ink last:border-b-0 max-sm:flex-wrap"
              >
                <div className="flex-1 min-w-[160px]">
                  <b className="font-display text-[15px] block">{line.productName}</b>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey">
                    {line.optionName} × {line.quantity}
                  </span>
                </div>
                <b className="font-display text-[15px] num">{formatKRW(line.lineSubtotal)}</b>
              </li>
            ))}
          </ul>

          <div className="border-[1.5px] border-ink p-[16px]">
            <TotalRow label={t("subtotal")} value={formatKRW(subtotal)} />
            {discount > 0 && (
              <TotalRow label={t("discount")} value={`−${formatKRW(discount)}`} muted />
            )}
            <TotalRow
              label={t("shipping")}
              value={freeShipping ? t("freeShipping") : t("shippingCalcNote")}
              muted
            />
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-grey mt-[6px] mb-0">
              {t("freeShippingNote", { amount: formatKRW(FREE_SHIPPING_OVER) })}
            </p>
            <div className="flex justify-between items-baseline border-t-[1.5px] border-ink mt-[12px] pt-[12px]">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em]">{t("grandTotal")}</span>
              <b className="font-display text-[20px] num">{formatKRW(subtotal - discount)}</b>
            </div>
            <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-grey mt-[8px] mb-0">
              {t("finalTotalNote")}
            </p>
          </div>
        </section>

        {/* ── 결제 안내 + CTA ── */}
        <section>
          {note && (
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#c0392b] mb-[14px]">
              ✕ {note}
            </p>
          )}
          <Button
            onClick={placeOrder}
            disabled={busy || addresses.length === 0}
            className="w-full max-sm:w-full"
          >
            {busy ? "…" : t("placeOrder")}
          </Button>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-grey mt-[12px] mb-0 text-center">
            {t("mockPaymentNote")}
          </p>
        </section>
      </div>
    </PageShell>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-grey mt-0 mb-[14px]">
      {children}
    </h2>
  );
}

function TotalRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-[3px]">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey">{label}</span>
      <span className={`font-mono text-[12px] num ${muted ? "text-grey" : "text-ink"}`}>{value}</span>
    </div>
  );
}

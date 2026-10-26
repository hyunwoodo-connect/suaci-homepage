"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import PageShell from "@/components/shell/PageShell";
import AddressForm from "@/components/pay/AddressForm";
import MethodPicker from "@/components/pay/MethodPicker";
import { CHECKOUT_PRICING, DELIVERY_MEMOS, displayTotal } from "@/constants/checkout";
import { PRODUCT } from "@/constants/product";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { useCart } from "@/lib/cart/cart-context";
import { formatKRW } from "@/lib/format";
import { readPendingOrder, reuseKey, savePendingOrder } from "@/lib/payment/pending";
import {
  adapterFor,
  availableMethods,
  defaultMethod,
  selectPaymentAdapters,
  type PayMethodId,
} from "@/lib/payment/providers";
import type { Address, CreateAddressRequest, SocialProvider } from "@/types";

/** 처리 가능한 주문 에러 코드 → 메시지 키. 그 외는 GENERIC. */
const KNOWN_ERROR_CODES = [
  "EMPTY_CART",
  "ADDRESS_NOT_FOUND",
  "PAYMENT_AMOUNT_MISMATCH",
  "OUT_OF_STOCK",
  "AUTH_REQUIRED",
] as const;

const MEMO_KEY = "suaci.checkout.memo";

/**
 * 주문서 — 첫 구매·배송지 변경용 한 화면(스펙 §2 C). 배송지(없으면 Daum 레이어로 바로 만들기) →
 * 배송 메모 → 결제수단 → 결제하기. 재구매는 홈의 재구매 시트가 담당한다.
 */
export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutBody />
    </Suspense>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function CheckoutBody() {
  const t = useTranslations("checkout");
  const tp = useTranslations("pay");
  const router = useRouter();
  const search = useSearchParams();
  const { status, user } = useAuth();
  const { clear, add } = useCart();

  // 수량: 쿼리 > 보류 주문(이어가기 — "적은 건 그대로") > 1
  const qtyParam = Number(search.get("qty"));
  const [pendingQty, setPendingQty] = useState<number | null>(null);
  const qty =
    Number.isInteger(qtyParam) && qtyParam >= 1
      ? Math.min(qtyParam, PRODUCT.maxQuantity)
      : (pendingQty ?? 1);
  const first = search.get("first") === "1";
  const total = displayTotal(qty);

  useEffect(() => {
    Promise.resolve().then(() => {
      const p = readPendingOrder();
      if (p && p.qty >= 1) setPendingQty(Math.min(p.qty, PRODUCT.maxQuantity));
    });
  }, []);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrLoaded, setAddrLoaded] = useState(false);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [method, setMethod] = useState<PayMethodId>("CARD");
  const [memo, setMemo] = useState<string>(DELIVERY_MEMOS[0]);
  const [customMemo, setCustomMemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // 로그인 게이트 — 미인증이면 로그인으로(복귀 경로 포함)
  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=/checkout?qty=${String(qty)}`);
  }, [status, router, qty]);

  const refreshAddresses = useCallback(() => {
    void api
      .listAddresses()
      .then((list) => {
        setAddresses(list);
        setAddrLoaded(true);
      })
      .catch(() => {
        setAddrLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (status === "authenticated") refreshAddresses();
  }, [status, refreshAddresses]);

  // 저장한 메모·기본 수단(지난 수단 없음 → 프로바이더 페이 → 카드)
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const saved = localStorage.getItem(MEMO_KEY);
        if (saved) {
          setMemo(saved);
          if (!(DELIVERY_MEMOS as readonly string[]).includes(saved)) setCustomMemo(true);
        }
        const provider = localStorage.getItem("suaci.auth.lastProvider") as SocialProvider | null;
        setMethod(defaultMethod({ lastPaymentMethod: null, loginProvider: provider }));
      } catch {}
    });
  }, []);

  const adapters = selectPaymentAdapters(
    {
      tossClientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
      apiMode: process.env.NEXT_PUBLIC_API_MODE ?? "mock",
      nodeEnv: process.env.NODE_ENV,
    },
    typeof window === "undefined"
      ? undefined
      : {
          origin: window.location.origin,
          navigate: (url) => {
            window.location.assign(url);
          },
        },
  );
  const methods = availableMethods(adapters);
  const ready = adapters.length > 0;

  const defaultId = (addresses.find((a) => a.isDefault) ?? addresses[0])?.addressId ?? null;
  const selectedId =
    overrideId && addresses.some((a) => a.addressId === overrideId) ? overrideId : defaultId;
  const selected = addresses.find((a) => a.addressId === selectedId) ?? null;

  const saveAddress = async (r: CreateAddressRequest) => {
    await api.createAddress(r);
    setShowForm(false);
    refreshAddresses();
  };

  const pay = async () => {
    if (busy || !ready) return;
    if (!selected) {
      setNote(t("selectAddress"));
      return;
    }
    const adapter = adapterFor(adapters, method);
    if (!adapter) return;
    setBusy(true);
    setNote(null);
    try {
      await clear();
      await add({ productId: PRODUCT.productId, variantId: PRODUCT.variantId, quantity: qty });
      try {
        localStorage.setItem(MEMO_KEY, memo);
      } catch {}
      // 금액·배송지·메모가 전부 같을 때만 기존 키 — 서버는 멱등 히트면 입력을 무시한다
      const idempotencyKey =
        reuseKey(readPendingOrder(), { amount: total, addressId: selected.addressId, memo }) ??
        crypto.randomUUID();
      const order = await api.createOrder({
        addressId: selected.addressId,
        idempotencyKey,
        metadata: { deliveryMemo: memo, channel: "web", screen: "checkout" },
      });
      savePendingOrder({
        orderId: order.orderId,
        orderNo: order.orderNo,
        amount: order.totals.grandTotal,
        idempotencyKey,
        qty,
        addressId: selected.addressId,
        memo,
      });
      await adapter.request(method, {
        orderId: order.orderId,
        orderNo: order.orderNo,
        orderName: `${PRODUCT.name} ${String(qty)}`,
        amount: order.totals.grandTotal,
        customerKey: user?.userId ?? "anonymous",
        successPath: `/pay/complete?o=${order.orderId}${first ? "&first=1" : ""}`,
        failPath: `/pay/fail?o=${order.orderId}`,
      });
    } catch (e) {
      if (e instanceof ApiClientError) {
        const known = (KNOWN_ERROR_CODES as readonly string[]).includes(e.code);
        setNote(known ? t(`error.${e.code}`) : t("error.GENERIC"));
        if (e.code === "AUTH_REQUIRED") router.replace("/login?next=/checkout");
      } else {
        setNote(t("error.GENERIC"));
      }
      setBusy(false);
    }
  };

  if (status !== "authenticated") {
    return (
      <PageShell
        title={
          <>
            Check <em>out</em>
          </>
        }
        meta=""
      >
        <p className="font-sans text-[11px] text-grey">…</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={
        <>
          Check <em>out</em>
        </>
      }
      meta={t("meta")}
    >
      <div className="flex max-w-[480px] flex-col gap-[28px]">
        {/* ── 배송지 ── */}
        <section>
          <SectionLabel>{t("addressTitle")}</SectionLabel>
          {!addrLoaded ? (
            <p className="m-0 font-sans text-[11px] text-grey">…</p>
          ) : addresses.length === 0 || showForm ? (
            <div>
              <h3 className="m-0 mb-[14px] text-[16px] font-medium">{tp("checkout.whereTo")}</h3>
              <AddressForm
                onSubmit={saveAddress}
                submitLabel={t("addAddress")}
                initialRecipient={user?.name}
              />
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-[12px] p-0">
              {addresses.map((a) => {
                const active = a.addressId === selectedId;
                return (
                  <li key={a.addressId}>
                    <button
                      type="button"
                      onClick={() => {
                        setOverrideId(a.addressId);
                      }}
                      aria-pressed={active}
                      className={`w-full cursor-pointer border border-line p-[16px] text-left transition-colors ${
                        active ? "bg-ink text-paper" : "bg-transparent text-ink hover:bg-[#f0f0ea]"
                      }`}
                    >
                      <div className="mb-[6px] flex items-center gap-[10px]">
                        <b className="font-sans text-[15px]">{a.recipient}</b>
                        <span
                          className={`num font-sans text-[11px] ${active ? "text-paper/70" : "text-grey"}`}
                        >
                          {a.phone}
                        </span>
                        {a.isDefault && (
                          <span
                            className={`px-[7px] py-[2px] font-sans text-[10px] ${
                              active ? "bg-lime text-ink" : "bg-ink text-lime"
                            }`}
                          >
                            {t("defaultBadge")}
                          </span>
                        )}
                      </div>
                      <p
                        className={`m-0 text-[13.5px] leading-[1.6] ${active ? "text-paper/90" : ""}`}
                      >
                        ({a.zipcode}) {a.addr1}
                        <br />
                        {a.addr2 ?? ""}
                      </p>
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(true);
                  }}
                  className="mt-[2px] cursor-pointer font-sans text-[11px] text-grey underline underline-offset-[3px] hover:text-ink"
                >
                  + {t("addAddress")}
                </button>
              </li>
            </ul>
          )}
        </section>

        {/* ── 배송 메모 ── */}
        <section>
          <SectionLabel>{tp("sheet.memo")}</SectionLabel>
          <div className="flex flex-wrap items-center gap-[8px]">
            {DELIVERY_MEMOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMemo(m);
                  setCustomMemo(false);
                }}
                className={`cursor-pointer rounded-full border px-[14px] py-[8px] text-[13px] ${
                  memo === m && !customMemo ? "border-ink bg-ink text-paper" : "border-line"
                }`}
              >
                {m}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setCustomMemo(true);
                setMemo("");
              }}
              className={`cursor-pointer rounded-full border px-[14px] py-[8px] text-[13px] ${
                customMemo ? "border-ink bg-ink text-paper" : "border-line"
              }`}
            >
              {tp("sheet.customMemo")}
            </button>
            {customMemo && (
              <input
                value={memo}
                onChange={(e) => {
                  setMemo(e.target.value);
                }}
                maxLength={40}
                className="w-full border border-line px-[12px] py-[10px] text-[16px]"
                autoFocus
              />
            )}
          </div>
        </section>

        {/* ── 결제수단 ── */}
        <section>
          <SectionLabel>{tp("sheet.method")}</SectionLabel>
          {ready ? (
            <>
              <MethodPicker methods={methods} value={method} onChange={setMethod} />
              {method === "BRANDPAY" && (
                <p className="m-0 mt-[8px] text-[12px] text-grey">{tp("checkout.brandpayHint")}</p>
              )}
            </>
          ) : (
            <p className="m-0 text-[13px] text-grey">{tp("sheet.preparing")}</p>
          )}
        </section>

        {/* ── 합계 + CTA ── */}
        <section>
          <div className="mb-[16px] border border-line p-[16px]">
            <TotalRow
              label={`${PRODUCT.name} × ${String(qty)}`}
              value={formatKRW(CHECKOUT_PRICING.price * qty)}
            />
            <TotalRow
              label={t("shipping")}
              value={
                total === CHECKOUT_PRICING.price * qty
                  ? t("freeShipping")
                  : formatKRW(CHECKOUT_PRICING.shippingFee)
              }
              muted
            />
            <div className="mt-[12px] flex items-baseline justify-between border-t border-line pt-[12px]">
              <span className="font-sans text-[10px]">{t("grandTotal")}</span>
              <b className="num font-sans text-[20px]">{formatKRW(total)}</b>
            </div>
          </div>
          {note && <p className="mb-[14px] font-sans text-[11px] text-[#c0392b]">✕ {note}</p>}
          <button
            type="button"
            onClick={() => {
              void pay();
            }}
            disabled={busy || !ready || !selected}
            className="h-[52px] w-full cursor-pointer rounded-full bg-ink text-[15px] font-medium text-paper disabled:opacity-50"
          >
            {busy ? tp("sheet.paying") : tp("sheet.payCta", { total: formatKRW(total) })}
          </button>
        </section>
      </div>
    </PageShell>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-[14px] mt-0 font-sans text-[11px] text-grey">{children}</h2>;
}

function TotalRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-[3px]">
      <span className="font-sans text-[10px] text-grey">{label}</span>
      <span className={`num font-sans text-[12px] ${muted ? "text-grey" : "text-ink"}`}>
        {value}
      </span>
    </div>
  );
}

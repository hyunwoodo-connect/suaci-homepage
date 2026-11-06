"use client";

import { Suspense, useCallback, useEffect, useState } from "react";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Link, useRouter } from "@/i18n/navigation";
import PageShell from "@/components/shell/PageShell";
import ReturnNotice from "@/components/legal/ReturnNotice";
import AddressForm from "@/components/pay/AddressForm";
import MemoPicker from "@/components/pay/MemoPicker";
import MethodPicker from "@/components/pay/MethodPicker";
import { CHIP, CHIP_OFF } from "@/components/pay/chip";
import { orderErrorKey } from "@/components/pay/orderError";
import { CHECKOUT_PRICING, DELIVERY_MEMOS, displayTotal } from "@/constants/checkout";
import { PRODUCT } from "@/constants/product";
import { api, isAuthRequired } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { readLastProvider } from "@/lib/auth/social";
import { addressName } from "@/lib/checkout/address";
import { readSavedMemo } from "@/lib/checkout/memo";
import { formatKRW } from "@/lib/format";
import { readPendingOrder } from "@/lib/payment/pending";
import {
  adapterFor,
  availableMethods,
  browserPaymentAdapters,
  defaultMethod,
  paymentEnv,
  PREVIEW_METHODS,
  type PayMethodId,
} from "@/lib/payment/providers";
import { startPayment } from "@/lib/payment/start-payment";
import { isTestClientKey } from "@/lib/payment/toss";
import type { Address, CreateAddressRequest } from "@/types";
import Button from "@/components/ui/Button";

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
  const tc = useTranslations("common");
  const tProduct = useTranslations("home.product");
  const router = useRouter();
  const search = useSearchParams();
  const { status, user, recheckSession } = useAuth();

  // 수량: 쿼리 > 보류 주문(이어가기 — "적은 건 그대로") > 1
  const qtyParam = Number(search.get("qty"));
  const [pendingQty, setPendingQty] = useState<number | null>(null);
  const qty =
    Number.isInteger(qtyParam) && qtyParam >= 1
      ? Math.min(qtyParam, PRODUCT.maxQuantity)
      : (pendingQty ?? 1);
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
      const saved = readSavedMemo();
      if (saved) {
        setMemo(saved.memo);
        if (saved.isCustom) setCustomMemo(true);
      }
      setMethod(defaultMethod({ lastPaymentMethod: null, loginProvider: readLastProvider() }));
    });
  }, []);

  const adapters = browserPaymentAdapters();
  const methods = availableMethods(adapters);
  const ready = adapters.length > 0;
  // 카드 심사 동안 운영도 토스 테스트 키로 연다 — 손님이 실제로 산 줄 알지 않게 알린다
  const isTestPayment = isTestClientKey(paymentEnv().tossClientKey);

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
      await startPayment({
        adapter,
        method,
        qty,
        addressId: selected.addressId,
        memo,
        screen: "checkout",
        customerKey: user?.userId ?? "anonymous",
      });
      // 여기까지 오면 손님이 결제창을 닫은 것(결제되면 토스가 다른 주소로 보낸다) — 다시 누를 수 있게
      setBusy(false);
    } catch (e) {
      setNote(t(orderErrorKey(e)));
      // 토큰이 풀렸는데 화면 상태만 남은 경우 — 상태를 다시 확인하면 로그인으로 보내는 효과가 수량까지 붙여 보낸다
      if (isAuthRequired(e)) void recheckSession();
      setBusy(false);
    }
  };

  if (status !== "authenticated") {
    return (
      <PageShell title={t("title")}>
        <p className="m-0 text-[14px] text-grey">{tc("loading")}</p>
      </PageShell>
    );
  }

  return (
    <PageShell title={t("title")}>
      <div className="flex max-w-[480px] flex-col gap-[28px]">
        {/* 출시 전엔 주소를 다 쓰고 나서야 막히지 않게 — 맨 위에서 먼저 알린다 */}
        {!ready && (
          <p className="m-0 flex items-start gap-[10px] border border-line px-[14px] py-[12px] text-[13px] leading-[1.6] text-ink">
            <span
              aria-hidden="true"
              className="mt-[7px] size-[7px] shrink-0 rounded-full bg-lime"
            />
            {tp("checkout.closedNotice")}
          </p>
        )}
        {/* ── 배송지 ── */}
        <section>
          <SectionLabel>{t("addressTitle")}</SectionLabel>
          {!addrLoaded ? (
            <p className="m-0 text-[14px] text-grey">{tc("loading")}</p>
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
                      className={`w-full cursor-pointer border p-[16px] text-left transition-colors ${
                        active
                          ? "border-ink bg-ink text-paper"
                          : "border-line bg-transparent text-ink hover:border-ink"
                      }`}
                    >
                      <div className="mb-[6px] flex flex-wrap items-center gap-x-[10px] gap-y-[2px]">
                        <b className="text-[15px] font-medium">{addressName(a)}</b>
                        <span
                          className={`num text-[13px] ${active ? "text-paper/80" : "text-grey"}`}
                        >
                          {addressName(a) === a.recipient ? a.phone : `${a.recipient} · ${a.phone}`}
                        </span>
                        {/* 상태 표시 — 버튼(알약)과 다르게 각진 작은 표. 라임 위 글자는 먹색이라 고른 칸(검정)·안 고른 칸(흰색) 어디서나 읽힌다 */}
                        {a.isDefault && (
                          <span className="cursor-default select-none rounded-[4px] bg-lime px-[6px] py-[1px] text-[12px] text-ink">
                            {t("defaultBadge")}
                          </span>
                        )}
                      </div>
                      <p
                        className={`m-0 text-[14px] leading-[1.6] ${active ? "text-paper/90" : ""}`}
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
                  className="flex min-h-[44px] cursor-pointer items-center text-[14px] text-ink underline underline-offset-[3px] hover:text-grey"
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
          <MemoPicker
            memo={memo}
            isCustom={customMemo}
            onPick={(m) => {
              setMemo(m);
              setCustomMemo(false);
            }}
            onCustom={() => {
              setCustomMemo(true);
              setMemo("");
            }}
            onType={setMemo}
          />
        </section>

        {/* ── 결제수단 ── */}
        <section>
          <SectionLabel>{tp("sheet.method")}</SectionLabel>
          {ready ? (
            <>
              <MethodPicker methods={methods} value={method} onChange={setMethod} />
              {method === "BRANDPAY" && (
                <p className="m-0 mt-[8px] text-[13px] text-grey">{tp("checkout.brandpayHint")}</p>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-[8px]">
                {PREVIEW_METHODS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    disabled
                    className={`${CHIP} ${CHIP_OFF} cursor-default text-grey opacity-60`}
                  >
                    {tp(`method.${id}`)}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ── 합계 + CTA ── */}
        <section>
          <div className="mb-[16px] border border-line p-[16px]">
            <TotalRow
              label={`${tProduct("name")} × ${String(qty)}`}
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
              <span className="text-[15px] font-medium">{t("grandTotal")}</span>
              <b className="num text-[20px] font-medium">{formatKRW(total)}</b>
            </div>
          </div>
          <ReturnNotice className="mb-[14px]" />
          {note && (
            <p role="alert" className="mb-[14px] text-[13px] text-alert">
              {note}
            </p>
          )}
          <Button
            type="button"
            onClick={() => {
              void pay();
            }}
            disabled={busy || !ready || !selected}
            className="w-full"
          >
            {!ready
              ? tp("sheet.preparingCta")
              : busy
                ? tp("sheet.paying")
                : tp("sheet.payCta", { total: formatKRW(total) })}
          </Button>
          {ready && isTestPayment && (
            <p className="m-0 mt-[8px] text-center text-[13px] text-grey">
              {tp("sheet.testNotice")}
            </p>
          )}
          {/* 결제를 열기 전(카드 심사 중)에는 여기까지가 끝 — 주문은 만들지 않고 출시 알림으로 보낸다 */}
          {!ready && (
            <Link
              href="/notify"
              className="mt-[6px] flex min-h-[44px] items-center justify-center text-[14px] text-grey underline underline-offset-[3px] hover:text-ink"
            >
              {tp("bar.notify")}
            </Link>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-[12px] mt-0 text-[14px] font-medium text-ink">{children}</h2>;
}

function TotalRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-[12px] py-[4px]">
      <span className="text-[14px] text-grey">{label}</span>
      <span className={`num shrink-0 text-[14px] ${muted ? "text-grey" : "text-ink"}`}>
        {value}
      </span>
    </div>
  );
}

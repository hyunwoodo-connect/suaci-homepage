"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { DELIVERY_MEMOS, displayTotal } from "@/constants/checkout";
import { PRODUCT } from "@/constants/product";
import MethodPicker from "@/components/pay/MethodPicker";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { useCart } from "@/lib/cart/cart-context";
import { formatKRW } from "@/lib/format";
import { readPendingOrder, savePendingOrder } from "@/lib/payment/pending";
import {
  adapterFor,
  availableMethods,
  defaultMethod,
  PAY_METHOD_LABEL,
  selectPaymentAdapters,
  type PayMethodId,
} from "@/lib/payment/providers";
import type { CheckoutDefaults, SocialProvider } from "@/types";

interface ReBuySheetProps {
  qty: number;
  defaults: CheckoutDefaults;
  onClose: () => void;
}

const MEMO_KEY = "suaci.checkout.memo";

/**
 * 재구매 시트 — "지난번처럼 보낼게요." 주소·수단·메모 세 줄을 미리 채워 결제 한 번으로 끝낸다(스펙 §2 A).
 * 30분 안에 돌아온 보류 주문은 같은 멱등키로 잇는다(결정 12).
 */
export default function ReBuySheet({ qty, defaults, onClose }: ReBuySheetProps) {
  const t = useTranslations("pay.sheet");
  const tc = useTranslations("pay.checkout");
  const router = useRouter();
  const { user } = useAuth();
  const { clear, add } = useCart();

  const [method, setMethod] = useState<PayMethodId>("CARD");
  const [memo, setMemo] = useState<string>(DELIVERY_MEMOS[0]);
  const [customMemo, setCustomMemo] = useState(false);
  const [pickMethod, setPickMethod] = useState(false);
  const [pickMemo, setPickMemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(true);

  // 어댑터 목록 — 실키가 오면 selectPaymentAdapters 가 토스 위젯을 돌려준다
  const adapters = useMemo(
    () =>
      selectPaymentAdapters(
        {
          tossClientKey: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
          apiMode: process.env.NEXT_PUBLIC_API_MODE ?? "mock",
          nodeEnv: process.env.NODE_ENV,
        },
        {
          origin: window.location.origin,
          navigate: (url) => {
            window.location.assign(url);
          },
        },
      ),
    [],
  );
  const methods = useMemo(() => availableMethods(adapters), [adapters]);
  const ready = adapters.length > 0;

  // 저장된 메모·기본 수단은 마운트 뒤에 읽는다(렌더 중 storage 접근 금지, setState 는 .then 안 — 린트)
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const saved = localStorage.getItem(MEMO_KEY);
        if (saved) {
          setMemo(saved);
          if (!(DELIVERY_MEMOS as readonly string[]).includes(saved)) setCustomMemo(true);
        }
        const provider = localStorage.getItem("suaci.auth.lastProvider") as SocialProvider | null;
        setMethod(
          defaultMethod({ lastPaymentMethod: defaults.lastPaymentMethod, loginProvider: provider }),
        );
      } catch {}
    });
  }, [defaults.lastPaymentMethod]);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const total = displayTotal(qty);
  const address = defaults.address;

  const pay = async () => {
    if (busy || !ready || !address) return;
    const adapter = adapterFor(adapters, method);
    if (!adapter) {
      setNote(t("preparing"));
      return;
    }
    setBusy(true);
    setNote(t("paying"));
    try {
      await clear();
      await add({ productId: PRODUCT.productId, variantId: PRODUCT.variantId, quantity: qty });
      try {
        localStorage.setItem(MEMO_KEY, memo);
      } catch {}
      const pending = readPendingOrder();
      const idempotencyKey =
        pending && pending.amount === total ? pending.idempotencyKey : crypto.randomUUID();
      const order = await api.createOrder({
        addressId: address.addressId,
        idempotencyKey,
        metadata: { deliveryMemo: memo, channel: "web", screen: "rebuy-sheet" },
      });
      savePendingOrder({
        orderId: order.orderId,
        orderNo: order.orderNo,
        amount: order.totals.grandTotal,
        idempotencyKey,
        qty,
      });
      await adapter.request(method, {
        orderId: order.orderId,
        orderNo: order.orderNo,
        orderName: `${PRODUCT.name} ${String(qty)}`,
        amount: order.totals.grandTotal,
        customerKey: user?.userId ?? "anonymous",
        successPath: `/pay/complete?o=${order.orderId}`,
        failPath: `/pay/fail?o=${order.orderId}`,
      });
    } catch {
      setNote(null);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/30"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rebuy-title"
        tabIndex={-1}
        className="relative flex w-full max-w-[480px] flex-col gap-[16px] rounded-t-[20px] bg-paper px-[20px] pb-[32px] pt-[16px] outline-none"
      >
        <span aria-hidden="true" className="mx-auto h-[4px] w-[36px] rounded-full bg-line" />
        <h2 id="rebuy-title" className="m-0 text-[17px] font-medium">
          {t("title")}
        </h2>

        <SheetRow
          label={t("address")}
          onChange={() => {
            router.push(`/checkout?qty=${String(qty)}`);
          }}
          changeLabel={t("change")}
        >
          {address ? `${address.addr1} ${address.addr2 ?? ""} · ${address.recipient}` : ""}
        </SheetRow>

        <SheetRow
          label={t("method")}
          onChange={() => {
            setPickMethod((v) => !v);
          }}
          changeLabel={t("change")}
        >
          {PAY_METHOD_LABEL[method]}
        </SheetRow>
        {pickMethod && <MethodPicker methods={methods} value={method} onChange={setMethod} />}

        <SheetRow
          label={t("memo")}
          onChange={() => {
            setPickMemo((v) => !v);
          }}
          changeLabel={t("change")}
        >
          {memo}
        </SheetRow>
        {pickMemo && (
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
              {t("customMemo")}
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
        )}

        {method === "BRANDPAY" && <p className="m-0 text-[12px] text-grey">{tc("brandpayHint")}</p>}

        <button
          type="button"
          onClick={() => {
            void pay();
          }}
          disabled={busy || !ready}
          className="h-[52px] cursor-pointer rounded-full bg-ink text-[15px] font-medium text-paper disabled:opacity-50"
        >
          {t("payCta", { total: formatKRW(total) })}
        </button>
        <p role="status" className="m-0 min-h-[18px] text-center text-[12px] text-grey">
          {note ?? (!ready ? t("preparing") : "")}
        </p>
      </div>
    </div>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function SheetRow({
  label,
  children,
  onChange,
  changeLabel,
}: {
  label: string;
  children: React.ReactNode;
  onChange: () => void;
  changeLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-[12px] border-b border-line pb-[12px]">
      <div className="min-w-0">
        <p className="m-0 text-[11px] text-grey">{label}</p>
        <p className="m-0 truncate text-[14px]">{children}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 cursor-pointer text-[12px] text-grey underline underline-offset-[3px] hover:text-ink"
      >
        {changeLabel}
      </button>
    </div>
  );
}

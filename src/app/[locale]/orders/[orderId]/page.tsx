"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import PageShell from "@/components/shell/PageShell";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { formatKRW } from "@/lib/format";
import type {
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
  ReasonCode,
} from "@/types";

const REASON_CODES: readonly ReasonCode[] = [
  "단순변심",
  "상품하자",
  "오배송",
  "표시광고상이",
  "배송지연",
  "기타",
];

/** 백엔드 에러 코드 → claims.error.* 메시지 키. 매핑에 없으면 default. */
const ERROR_KEYS: Record<string, string> = {
  ORDER_NOT_CANCELLABLE: "ORDER_NOT_CANCELLABLE",
  CLAIM_NOT_ALLOWED: "CLAIM_NOT_ALLOWED",
  OVER_REFUND: "OVER_REFUND",
};

/**
 * 주문 상세 — getOrder / listClaims 계약 호출 + 주문 취소·환불 요청 액션.
 * ?welcome=1(체크아웃 직후) 이면 상단에 완료 배너 표시.
 */
export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  return (
    <Suspense>
      <OrderDetail orderId={orderId} />
    </Suspense>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function OrderDetail({ orderId }: { orderId: string }) {
  const t = useTranslations("orders");
  const { status } = useAuth();
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";

  const [order, setOrder] = useState<Order | null>(null);

  const refresh = useCallback(async () => {
    setOrder(await api.getOrder(orderId));
  }, [orderId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    // Inline load (matches the existing .then()-in-effect pattern that satisfies
    // react-hooks/set-state-in-effect). `refresh` is used by action handlers.
    void api.getOrder(orderId).then(setOrder).catch(() => setOrder(null));
  }, [status, orderId]);

  return (
    <PageShell no="OR" title={<>Order <em>detail</em></>} meta={order?.orderNo ?? ""}>
      {!order ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey">…</p>
      ) : (
        <div className="max-w-[860px]">
          {welcome && (
            <div className="border-[1.5px] border-ink bg-acid px-[16px] py-[13px] mb-[20px] flex items-baseline justify-between gap-[12px] flex-wrap">
              <b className="font-display text-[15px] text-ink">{t("welcomeTitle")}</b>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink num">
                {t("welcomeOrderNo", { orderNo: order.orderNo })}
              </span>
            </div>
          )}

          {/* 상태 라인 */}
          <div className="flex gap-[8px] flex-wrap mb-[20px]">
            <StatusBadge label={t("statusLabel")} value={t(`orderStatus.${order.status}`)} tone={orderTone(order.status)} />
            <StatusBadge label={t("paymentLabel")} value={t(`paymentStatus.${order.paymentStatus}`)} tone={paymentTone(order.paymentStatus)} />
            <StatusBadge label={t("fulfillmentLabel")} value={t(`fulfillmentStatus.${order.fulfillmentStatus}`)} tone={fulfillmentTone(order.fulfillmentStatus)} />
          </div>

          {/* 품목 */}
          <ul className="list-none m-0 p-0 border-[1.5px] border-ink mb-[20px]">
            {order.items.map((item) => (
              <li
                key={item.lineId}
                className="flex items-center gap-[16px] px-[16px] py-[13px] border-b-[1.5px] border-ink last:border-b-0"
              >
                <div className="flex-1">
                  <b className="font-display text-[15px] block">{item.productName}</b>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey">
                    {item.optionName} × {item.quantity}
                  </span>
                </div>
                <b className="font-display text-[15px] num">{formatKRW(item.lineSubtotal)}</b>
              </li>
            ))}
          </ul>

          {/* 합계 + 배송지 */}
          <div className="grid grid-cols-2 gap-[20px] max-sm:grid-cols-1 mb-[28px]">
            <div className="border-[1.5px] border-ink p-[16px]">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey mt-0 mb-[12px]">
                {t("payment")}
              </h3>
              <TotalRow label={t("subtotal")} value={formatKRW(order.totals.itemsSubtotal)} />
              <TotalRow label={t("shipping")} value={formatKRW(order.totals.shippingFee)} />
              <TotalRow label={t("discount")} value={`−${formatKRW(order.totals.discountTotal)}`} />
              <div className="flex justify-between items-baseline border-t-[1.5px] border-ink mt-[10px] pt-[10px]">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em]">{t("grandTotal")}</span>
                <b className="font-display text-[20px] num">{formatKRW(order.totals.grandTotal)}</b>
              </div>
            </div>
            <div className="border-[1.5px] border-ink p-[16px]">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey mt-0 mb-[12px]">
                {t("shippingTo")}
              </h3>
              <p className="text-[13.5px] text-ink m-0 leading-[1.7]">
                <b>{order.shippingAddress.recipient}</b>
                <br />
                ({order.shippingAddress.zipcode}) {order.shippingAddress.addr1}{" "}
                {order.shippingAddress.addr2 ?? ""}
                <br />
                {order.shippingAddress.phone}
              </p>
            </div>
          </div>

          {/* 관리 — 주문 취소 / 환불 요청 */}
          <OrderActions order={order} onDone={refresh} />

          <Link href="/orders" className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey hover:text-ink">
            ← All orders
          </Link>
        </div>
      )}
    </PageShell>
  );
}

/* ─── 관리 영역 (Task 1) ─────────────────────── */

function OrderActions({ order, onDone }: { order: Order; onDone: () => Promise<void> }) {
  const t = useTranslations("orders");
  const tc = useTranslations("claims");

  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCancel = order.status === "pending";
  const canRefund =
    (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded") &&
    order.fulfillmentStatus === "unfulfilled";

  if (!canCancel && !canRefund) return null;

  function errText(err: unknown): string {
    if (err instanceof ApiClientError && ERROR_KEYS[err.code]) {
      return tc(`error.${ERROR_KEYS[err.code]}`);
    }
    return tc("error.default");
  }

  const handleCancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.cancelOrder(order.orderId);
      setConfirmCancel(false);
      await onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-[1.5px] border-ink mb-[28px]">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey m-0 px-[16px] py-[12px] border-b-[1.5px] border-ink">
        {t("manage")}
      </h3>

      <div className="p-[16px] flex flex-col gap-[16px]">
        {error && <ErrorNote text={error} />}

        {/* 주문 취소 */}
        {canCancel && (
          <div className="flex items-center gap-[12px] flex-wrap">
            {!confirmCancel ? (
              <Button variant="outline" disabled={busy} onClick={() => { setError(null); setConfirmCancel(true); }}>
                {t("cancelOrder")}
              </Button>
            ) : (
              <>
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
                  {t("cancelConfirm")}
                </span>
                <Button variant="danger" disabled={busy} onClick={handleCancel}>
                  {busy ? "…" : t("cancelYes")}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setConfirmCancel(false)}>
                  {t("cancelNo")}
                </Button>
              </>
            )}
          </div>
        )}

        {/* 환불 요청 */}
        {canRefund && (
          !refundOpen ? (
            <Button variant="outline" disabled={busy} onClick={() => { setError(null); setRefundOpen(true); }}>
              {t("requestRefund")}
            </Button>
          ) : (
            <RefundForm
              order={order}
              busy={busy}
              setBusy={setBusy}
              onCancel={() => setRefundOpen(false)}
              onError={setError}
              errText={errText}
              onDone={async () => {
                setRefundOpen(false);
                await onDone();
              }}
            />
          )
        )}
      </div>
    </section>
  );
}

/* ─── 환불 폼 ────────────────────────────────── */

interface RefundFormProps {
  order: Order;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onCancel: () => void;
  onError: (m: string | null) => void;
  errText: (err: unknown) => string;
  onDone: () => Promise<void>;
}

function RefundForm({ order, busy, setBusy, onCancel, onError, errText, onDone }: RefundFormProps) {
  const tc = useTranslations("claims");

  const [reasonCode, setReasonCode] = useState<ReasonCode>("단순변심");
  const [reasonDetail, setReasonDetail] = useState("");
  const [scope, setScope] = useState<"full" | "partial">("full");
  // 부분 환불: lineId → 환불 수량 (0 = 미선택)
  const [qty, setQty] = useState<Record<string, number>>({});

  const setLineQty = (item: OrderItem, next: number) => {
    const clamped = Math.max(0, Math.min(item.quantity, next));
    setQty((prev) => ({ ...prev, [item.lineId]: clamped }));
  };

  const partialLines = order.items
    .map((it) => ({ lineId: it.lineId, quantity: qty[it.lineId] ?? 0 }))
    .filter((l) => l.quantity > 0);

  const partialInvalid = scope === "partial" && partialLines.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || partialInvalid) return;
    setBusy(true);
    onError(null);
    try {
      await api.createClaim(order.orderId, {
        idempotencyKey: crypto.randomUUID(),
        reasonCode,
        reasonDetail: reasonDetail.trim() || undefined,
        lines: scope === "partial" ? partialLines : undefined,
      });
      await onDone();
    } catch (err) {
      onError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-[1.5px] border-ink p-[16px] flex flex-col gap-[18px]">
      <b className="font-display text-[16px] text-ink">{tc("formTitle")}</b>

      {/* 사유 */}
      <fieldset className="border-0 p-0 m-0">
        <legend className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey mb-[8px] p-0">
          {tc("reason")}
        </legend>
        <div className="flex flex-wrap gap-[8px]">
          {REASON_CODES.map((code) => {
            const active = reasonCode === code;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={active}
                onClick={() => setReasonCode(code)}
                className={`font-mono text-[11px] uppercase tracking-[0.06em] px-[12px] py-[8px] border-[1.5px] border-ink transition-colors cursor-pointer ${
                  active ? "bg-ink text-acid" : "bg-transparent text-ink hover:bg-paper"
                }`}
              >
                {tc(`reasonCode.${code}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 상세 (선택) */}
      <div>
        <label className="block font-mono text-[10px] tracking-[0.1em] uppercase text-grey mb-[6px]">
          {tc("detail")}
        </label>
        <textarea
          value={reasonDetail}
          onChange={(e) => setReasonDetail(e.target.value)}
          rows={3}
          placeholder={tc("detailPlaceholder")}
          className="w-full border-[1.5px] border-ink bg-transparent px-[14px] py-[12px] font-mono text-[13px] text-ink outline-none focus:bg-paper transition-colors resize-y"
        />
      </div>

      {/* 범위 토글 */}
      <fieldset className="border-0 p-0 m-0">
        <legend className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey mb-[8px] p-0">
          {tc("scope")}
        </legend>
        <div className="flex gap-[8px]">
          {(["full", "partial"] as const).map((s) => {
            const active = scope === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                onClick={() => setScope(s)}
                className={`flex-1 font-mono text-[11px] uppercase tracking-[0.06em] px-[12px] py-[10px] border-[1.5px] border-ink transition-colors cursor-pointer ${
                  active ? "bg-ink text-acid" : "bg-transparent text-ink hover:bg-paper"
                }`}
              >
                {tc(s === "full" ? "scopeFull" : "scopePartial")}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 부분 환불 라인 선택 */}
      {scope === "partial" && (
        <ul className="list-none m-0 p-0 border-[1.5px] border-ink">
          {order.items.map((item) => {
            const value = qty[item.lineId] ?? 0;
            return (
              <li
                key={item.lineId}
                className="flex items-center gap-[12px] px-[14px] py-[12px] border-b-[1.5px] border-ink last:border-b-0 flex-wrap"
              >
                <div className="flex-1 min-w-[140px]">
                  <b className="font-display text-[14px] block">{item.productName}</b>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey">
                    {item.optionName} · {tc("ownedQty", { n: item.quantity })}
                  </span>
                </div>
                <div className="flex items-center border-[1.5px] border-ink">
                  <button
                    type="button"
                    aria-label={tc("decrease")}
                    onClick={() => setLineQty(item, value - 1)}
                    className="font-mono text-[13px] px-[12px] py-[6px] text-ink hover:bg-ink hover:text-acid transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                    disabled={value <= 0}
                  >
                    −
                  </button>
                  <span className="font-mono text-[13px] num min-w-[28px] text-center border-x-[1.5px] border-ink py-[6px]">
                    {value}
                  </span>
                  <button
                    type="button"
                    aria-label={tc("increase")}
                    onClick={() => setLineQty(item, value + 1)}
                    className="font-mono text-[13px] px-[12px] py-[6px] text-ink hover:bg-ink hover:text-acid transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                    disabled={value >= item.quantity}
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {partialInvalid && (
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-grey m-0">
          {tc("partialHint")}
        </p>
      )}

      <div className="flex gap-[8px]">
        <Button type="submit" disabled={busy || partialInvalid}>
          {busy ? "…" : tc("submit")}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          {tc("cancel")}
        </Button>
      </div>
    </form>
  );
}

/* ─── 상태 뱃지 & 톤 ─────────────────────────── */

type Tone = "solid" | "acid" | "muted" | "outline";

function orderTone(s: OrderStatus): Tone {
  if (s === "pending") return "outline";
  if (s === "cancelled") return "muted";
  return "solid";
}
function paymentTone(s: PaymentStatus): Tone {
  if (s === "paid") return "acid";
  if (s === "refunded" || s === "voided") return "muted";
  if (s === "pending") return "outline";
  return "solid";
}
function fulfillmentTone(s: FulfillmentStatus): Tone {
  if (s === "fulfilled") return "acid";
  if (s === "returned") return "muted";
  return "solid";
}

const TONE_CLASSES: Record<Tone, string> = {
  solid: "bg-ink text-acid",
  acid: "bg-acid text-ink border-[1.5px] border-ink",
  muted: "bg-transparent text-grey border-[1.5px] border-grey",
  outline: "bg-transparent text-ink border-[1.5px] border-ink",
};

function StatusBadge({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <span className={`inline-flex items-baseline gap-[6px] font-mono text-[10px] uppercase tracking-[0.1em] px-[8px] py-[3px] ${TONE_CLASSES[tone]}`}>
      <span className="opacity-60">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline py-[3px]">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey">{label}</span>
      <span className="font-mono text-[12px] num">{value}</span>
    </div>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#c0392b] m-0">
      ✕ {text}
    </p>
  );
}

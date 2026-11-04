"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { CHIP, CHIP_OFF, CHIP_ON } from "@/components/pay/chip";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import PageShell from "@/components/shell/PageShell";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDateKST, formatKRW } from "@/lib/format";
import type {
  Claim,
  ClaimStatus,
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
export default function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
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
  const tp = useTranslations("pay.result");
  const tc = useTranslations("common");
  const ta = useTranslations("account");
  const { status, sessionEnded, refresh: recheckSession } = useAuth();
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";
  const firstPurchase = searchParams.get("first") === "1";

  const [order, setOrder] = useState<Order | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  // 못 불러오면 '불러오는 중'에 멈추지 않고 이유와 돌아갈 길을 보여 준다
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    const [o, cs] = await Promise.all([
      api.getOrder(orderId),
      api.listClaims(orderId).catch(() => [] as Claim[]),
    ]);
    setOrder(o);
    setClaims(cs);
  }, [orderId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    // Inline load (matches the existing .then()-in-effect pattern that satisfies
    // react-hooks/set-state-in-effect). `refresh` is used by action handlers.
    void api
      .getOrder(orderId)
      .then(setOrder)
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.code === "AUTH_REQUIRED") {
          void recheckSession();
          return;
        }
        setLoadFailed(true);
      });
    void api
      .listClaims(orderId)
      .then(setClaims)
      .catch(() => setClaims([]));
  }, [status, orderId, recheckSession]);

  if (status === "anonymous") {
    return (
      <PageShell title={t("detailTitle")}>
        <div className="flex max-w-[400px] flex-col gap-[20px]">
          <p className="m-0 text-[15px] text-ink">
            {sessionEnded ? ta("sessionEnded") : t("needLogin")}
          </p>
          {/* 결제 직후(?welcome=1) 로그인이 풀렸어도 다시 들어오면 완료 띠까지 그대로 */}
          <ButtonLink
            href={{
              pathname: "/login",
              query: { next: `/orders/${orderId}${searchParams.size ? `?${searchParams}` : ""}` },
            }}
          >
            {ta("goLogin")}
          </ButtonLink>
        </div>
      </PageShell>
    );
  }

  if (loadFailed) {
    return (
      <PageShell title={t("detailTitle")}>
        <div className="flex max-w-[400px] flex-col gap-[20px]">
          <p role="alert" className="m-0 text-[15px] text-ink">
            {t("detailLoadError")}
          </p>
          <ButtonLink href="/orders" variant="outline">
            {t("backToList")}
          </ButtonLink>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={t("detailTitle")} meta={order?.orderNo ?? ""}>
      {!order ? (
        <p className="m-0 text-[14px] text-grey">{tc("loading")}</p>
      ) : (
        <div className="max-w-[860px]">
          {welcome && (
            // 이 화면의 라임은 이 띠 하나 — 위 글자는 먹색
            <div className="mb-[24px] flex flex-wrap items-baseline justify-between gap-[8px_16px] bg-lime px-[16px] py-[14px] text-ink">
              <div>
                <b className="block text-[17px] font-medium">{tp("done")}</b>
                <span className="text-[14px]">
                  {firstPurchase ? tp("doneFirst") : tp("doneSub")}
                </span>
              </div>
              <span className="num text-[13px]">
                {t("welcomeOrderNo", { orderNo: order.orderNo })}
              </span>
            </div>
          )}

          {/* 상태 라인 */}
          <div className="mb-[24px] flex flex-wrap gap-[8px]">
            <StatusBadge
              label={t("statusLabel")}
              value={t(`orderStatus.${order.status}`)}
              tone={orderTone(order.status)}
            />
            <StatusBadge
              label={t("paymentLabel")}
              value={t(`paymentStatus.${order.paymentStatus}`)}
              tone={paymentTone(order.paymentStatus)}
            />
            <StatusBadge
              label={t("fulfillmentLabel")}
              value={t(`fulfillmentStatus.${order.fulfillmentStatus}`)}
              tone={fulfillmentTone(order.fulfillmentStatus)}
            />
          </div>

          {/* 품목 */}
          <ul className="m-0 mb-[24px] list-none border-y border-line p-0">
            {order.items.map((item) => (
              <li
                key={item.lineId}
                className="flex items-center gap-[16px] border-b border-line py-[14px] last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <b className="block text-[15px] font-medium">{item.productName}</b>
                  <span className="num text-[13px] text-grey">
                    {item.optionName} × {item.quantity}
                  </span>
                </div>
                <b className="num shrink-0 text-[15px] font-medium">
                  {formatKRW(item.lineSubtotal)}
                </b>
              </li>
            ))}
          </ul>

          {/* 합계 + 배송지 */}
          <div className="mb-[28px] grid grid-cols-2 gap-[20px] max-sm:grid-cols-1">
            <div className="border border-line p-[16px]">
              <SectionTitle>{t("payment")}</SectionTitle>
              <TotalRow label={t("subtotal")} value={formatKRW(order.totals.itemsSubtotal)} />
              <TotalRow label={t("shipping")} value={formatKRW(order.totals.shippingFee)} />
              <TotalRow label={t("discount")} value={`−${formatKRW(order.totals.discountTotal)}`} />
              <div className="mt-[10px] flex items-baseline justify-between border-t border-line pt-[10px]">
                <span className="text-[15px] font-medium">{t("grandTotal")}</span>
                <b className="num text-[20px] font-medium">{formatKRW(order.totals.grandTotal)}</b>
              </div>
            </div>
            <div className="border border-line p-[16px]">
              <SectionTitle>{t("shippingTo")}</SectionTitle>
              <p className="m-0 text-[14px] leading-[1.7] text-ink">
                <b>{order.shippingAddress.recipient}</b>
                <br />({order.shippingAddress.zipcode}) {order.shippingAddress.addr1}{" "}
                {order.shippingAddress.addr2 ?? ""}
                <br />
                {order.shippingAddress.phone}
              </p>
            </div>
          </div>

          {/* 관리 — 주문 취소 / 환불 요청 */}
          <OrderActions order={order} onDone={refresh} />

          {/* 환불 내역 */}
          <ClaimsList claims={claims} />

          <Link
            href="/orders"
            className="inline-flex min-h-[44px] items-center text-[14px] text-grey hover:text-ink"
          >
            ← {t("title")}
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
    <section className="mb-[28px] border border-line p-[16px]">
      <SectionTitle>{t("manage")}</SectionTitle>

      <div className="flex flex-col gap-[16px]">
        {error && <ErrorNote text={error} />}

        {/* 주문 취소 */}
        {canCancel && (
          <div className="flex items-center gap-[12px] flex-wrap">
            {!confirmCancel ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setConfirmCancel(true);
                }}
              >
                {t("cancelOrder")}
              </Button>
            ) : (
              <>
                <span className="w-full text-[15px] text-ink">{t("cancelConfirm")}</span>
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
        {canRefund &&
          (!refundOpen ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setError(null);
                setRefundOpen(true);
              }}
            >
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
          ))}
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
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-[20px] border-t border-line pt-[16px]"
    >
      <b className="text-[16px] font-medium text-ink">{tc("formTitle")}</b>

      {/* 사유 */}
      <fieldset className="border-0 p-0 m-0">
        <legend className="mb-[10px] p-0 text-[13px] text-grey">{tc("reason")}</legend>
        <div className="flex flex-wrap gap-[8px]">
          {REASON_CODES.map((code) => {
            const active = reasonCode === code;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={active}
                onClick={() => setReasonCode(code)}
                className={`${CHIP} ${active ? CHIP_ON : CHIP_OFF}`}
              >
                {tc(`reasonCode.${code}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 상세 (선택) */}
      <div>
        <label htmlFor="refund-detail" className="mb-[6px] block text-[13px] text-grey">
          {tc("detail")}
        </label>
        <textarea
          id="refund-detail"
          value={reasonDetail}
          onChange={(e) => setReasonDetail(e.target.value)}
          rows={3}
          placeholder={tc("detailPlaceholder")}
          className="w-full resize-y border border-line bg-paper px-[12px] py-[11px] text-[16px] text-ink outline-none transition-colors focus:border-ink"
        />
      </div>

      {/* 범위 토글 */}
      <fieldset className="border-0 p-0 m-0">
        <legend className="mb-[10px] p-0 text-[13px] text-grey">{tc("scope")}</legend>
        <div className="flex gap-[8px]">
          {(["full", "partial"] as const).map((s) => {
            const active = scope === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={active}
                onClick={() => setScope(s)}
                className={`${CHIP} flex-1 justify-center ${active ? CHIP_ON : CHIP_OFF}`}
              >
                {tc(s === "full" ? "scopeFull" : "scopePartial")}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 부분 환불 라인 선택 */}
      {scope === "partial" && (
        <ul className="list-none m-0 p-0 border border-line">
          {order.items.map((item) => {
            const value = qty[item.lineId] ?? 0;
            return (
              <li
                key={item.lineId}
                className="flex items-center gap-[12px] px-[14px] py-[12px] border-b border-line last:border-b-0 flex-wrap"
              >
                <div className="flex-1 min-w-[140px]">
                  <b className="block text-[15px] font-medium">{item.productName}</b>
                  <span className="text-[13px] text-grey">
                    {item.optionName} · {tc("ownedQty", { n: item.quantity })}
                  </span>
                </div>
                <div className="flex items-center rounded-full border border-line">
                  <button
                    type="button"
                    aria-label={tc("decrease")}
                    onClick={() => setLineQty(item, value - 1)}
                    className="size-[44px] cursor-pointer text-[17px] text-ink disabled:pointer-events-none disabled:opacity-30"
                    disabled={value <= 0}
                  >
                    −
                  </button>
                  <span className="num min-w-[24px] text-center text-[15px]">{value}</span>
                  <button
                    type="button"
                    aria-label={tc("increase")}
                    onClick={() => setLineQty(item, value + 1)}
                    className="size-[44px] cursor-pointer text-[17px] text-ink disabled:pointer-events-none disabled:opacity-30"
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

      {partialInvalid && <p className="m-0 text-[13px] text-grey">{tc("partialHint")}</p>}

      <div className="flex flex-wrap gap-[8px]">
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

/* ─── 환불 내역 (Task 2) ─────────────────────── */

function ClaimsList({ claims }: { claims: Claim[] }) {
  const tc = useTranslations("claims");

  if (claims.length === 0) return null;

  return (
    <section className="mb-[28px] border border-line p-[16px] pb-0">
      <SectionTitle>{tc("historyTitle")}</SectionTitle>
      <ul className="m-0 list-none p-0">
        {claims.map((c) => (
          <li key={c.claimId} className="border-t border-line py-[14px]">
            <div className="flex items-center gap-[10px] flex-wrap mb-[6px]">
              <b className="text-[15px] font-medium">{tc(`reasonCode.${c.reasonCode}`)}</b>
              <ClaimStatusBadge status={c.status} label={tc(`status.${c.status}`)} />
              <b className="num ml-auto text-[15px] font-medium">{formatKRW(c.refundAmount)}</b>
            </div>
            {c.reasonDetail && (
              <p className="text-[13px] text-ink-soft m-0 mb-[6px] leading-[1.6]">
                {c.reasonDetail}
              </p>
            )}
            <div className="flex flex-wrap gap-x-[16px] gap-y-[2px] text-[13px] text-grey">
              <span>{tc("refundDue", { date: formatDateKST(c.refundDueAt) })}</span>
              <span>{tc("requestedAt", { date: c.createdDtm.slice(0, 10) })}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── 상태 뱃지 & 톤 ─────────────────────────── */

/** 끝난 것(채움) · 진행 중(선) · 꺼진 것(흐림). 라임은 쓰지 않는다 — 이 화면의 라임은 완료 띠 하나 */
type Tone = "done" | "active" | "muted";

function orderTone(s: OrderStatus): Tone {
  if (s === "completed") return "done";
  if (s === "cancelled") return "muted";
  return "active";
}
function paymentTone(s: PaymentStatus): Tone {
  if (s === "paid") return "done";
  if (s === "refunded" || s === "voided") return "muted";
  return "active";
}
function fulfillmentTone(s: FulfillmentStatus): Tone {
  if (s === "fulfilled") return "done";
  if (s === "returned") return "muted";
  return "active";
}

const TONE_CLASSES: Record<Tone, string> = {
  done: "border-ink bg-ink text-paper",
  active: "border-ink text-ink",
  muted: "border-line text-grey",
};

function StatusBadge({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <span
      className={`inline-flex items-baseline gap-[6px] rounded-full border px-[12px] py-[5px] text-[13px] ${TONE_CLASSES[tone]}`}
    >
      <span className="opacity-70">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function claimStatusTone(s: ClaimStatus): Tone {
  if (s === "completed" || s === "approved") return "done";
  if (s === "rejected" || s === "failed") return "muted";
  return "active";
}

function ClaimStatusBadge({ status, label }: { status: ClaimStatus; label: string }) {
  return (
    <span
      className={`rounded-full border px-[10px] py-[2px] text-[13px] ${TONE_CLASSES[claimStatusTone(status)]}`}
    >
      {label}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="m-0 mb-[12px] text-[14px] font-medium text-ink">{children}</h2>;
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-[12px] py-[4px]">
      <span className="text-[14px] text-grey">{label}</span>
      <span className="num shrink-0 text-[14px]">{value}</span>
    </div>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <p role="alert" className="m-0 text-[14px] text-alert">
      {text}
    </p>
  );
}

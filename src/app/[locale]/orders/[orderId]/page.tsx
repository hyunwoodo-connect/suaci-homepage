"use client";

import { Suspense, use, useCallback, useEffect, useState, type ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { CHIP, CHIP_OFF, CHIP_ON } from "@/components/pay/chip";
import LoginRequired from "@/components/shell/LoginRequired";
import PageShell from "@/components/shell/PageShell";
import Badge from "@/components/ui/Badge";
import Button, { buttonClasses } from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import Skeleton from "@/components/ui/Skeleton";
import { api, ApiClientError, isAuthRequired } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDateKST, formatKRW } from "@/lib/format";
import {
  REASON_CODES,
  type Claim,
  type FulfillmentStatus,
  type Order,
  type OrderItem,
  type ReasonCode,
} from "@/types";

import { CLAIM_STATUS_TONE, ORDER_STATE_TONE, orderState } from "../orderState";

/** 이름을 아는 택배사 코드(orders.carrier.*) — 모르는 코드는 그대로 보여 준다 */
const CARRIER_CODES: readonly string[] = ["cj", "epost", "hanjin", "lotte", "logen"];

/** 손님이 취소 요청할 수 있는 배송 상태 — 발송 전까지(환불 정책 v2 '발송 전 취소는 바로 환불') */
const BEFORE_SHIPMENT: readonly FulfillmentStatus[] = ["unfulfilled", "preparing"];

/** 취소·취소 요청이 막힌 이유 중 손님에게 따로 알리는 코드 — 메시지 `claims.error.{code}`. 그 밖은 default */
const CLAIM_ERRORS: readonly string[] = [
  "ORDER_NOT_CANCELLABLE",
  "CLAIM_NOT_ALLOWED",
  "OVER_REFUND",
];

// 실제 화면과 뼈대가 같은 크기가 되도록 상자·줄 틀을 한 곳에서 쓴다
const BOX = "border border-line p-[16px]";
const ITEM_ROW = "flex items-center gap-[16px] border-b border-line py-[14px] last:border-b-0";

interface OrderDetailData {
  order: Order;
  claims: Claim[];
}

/**
 * 주문 상세 — getOrder + listClaims 를 같이 받아 한 번에 그린다(취소 내역이 늦게 튀어나오지 않게).
 * 로그인 토큰이 브라우저에만 있어 서버에서 미리 못 받는다 — 받는 동안은 같은 틀의 뼈대.
 * ?welcome=1(결제 직후) 이면 위에 완료 띠.
 */
export default function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  return (
    <Suspense fallback={<OrderDetailLoading />}>
      <OrderDetail orderId={orderId} />
    </Suspense>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function OrderDetail({ orderId }: { orderId: string }) {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const { status, recheckSession } = useAuth();
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";

  const [data, setData] = useState<OrderDetailData | null>(null);
  // 못 불러오면 뼈대에 멈추지 않고 이유와 다시 시도할 길을 보여 준다
  const [loadFailed, setLoadFailed] = useState(false);

  // 취소 내역을 못 받아도 주문은 보여 준다(내역만 비운다)
  const fetchDetail = useCallback(async (): Promise<OrderDetailData> => {
    const [order, claims] = await Promise.all([
      api.getOrder(orderId),
      api.listClaims(orderId).catch(() => [] as Claim[]),
    ]);
    return { order, claims };
  }, [orderId]);

  const load = useCallback(
    () =>
      fetchDetail()
        .then(setData)
        .catch((err: unknown) => {
          if (isAuthRequired(err)) {
            void recheckSession();
            return;
          }
          setLoadFailed(true);
        }),
    [fetchDetail, recheckSession],
  );

  useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  if (status === "anonymous") {
    return (
      <LoginRequired
        title={t("detailTitle")}
        needLogin={t("needLogin")}
        cta={t("goLogin")}
        // 결제 직후(?welcome=1) 로그인이 풀렸어도 다시 들어오면 완료 띠까지 그대로
        next={`/orders/${orderId}${searchParams.size ? `?${searchParams}` : ""}`}
      />
    );
  }

  if (loadFailed) {
    return (
      <PageShell title={t("detailTitle")}>
        <div className="flex max-w-[400px] flex-col items-start gap-[16px]">
          <p role="alert" className="m-0 text-[15px] text-ink">
            {t("detailLoadError")}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setLoadFailed(false);
              void load();
            }}
          >
            {tc("retry")}
          </Button>
          <ButtonLink href="/orders" variant="text" size="sm">
            ← {t("backToList")}
          </ButtonLink>
        </div>
      </PageShell>
    );
  }

  if (!data) {
    return <OrderDetailLoading welcome={welcome} />;
  }

  const { order, claims } = data;
  const state = orderState(order);

  return (
    <PageShell title={t("detailTitle")} meta={order.orderNo}>
      <div className="max-w-[860px]">
        {welcome && <WelcomeBand orderNo={order.orderNo} />}

        {/* 상태 — 세 축을 이름 하나로 */}
        <div className="mb-[24px] flex flex-col items-start gap-[8px]">
          <Badge tone={ORDER_STATE_TONE[state]}>{t(`state.${state}`)}</Badge>
          {state === "awaitingPayment" && (
            <p className="m-0 text-[13px] text-grey">{t("payWithin")}</p>
          )}
          {order.carrier && order.trackingNumber && (
            <div className="flex flex-wrap items-center gap-[8px_16px]">
              <span className="num text-[13px] text-grey">
                {CARRIER_CODES.includes(order.carrier)
                  ? t(`carrier.${order.carrier}`)
                  : order.carrier}{" "}
                {order.trackingNumber}
              </span>
              {order.trackingUrl && (
                // 택배사 화면이라 새 탭으로 — 주문 화면은 그대로 둔다
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses("secondary", "sm")}
                >
                  {t("trackShipment")}
                </a>
              )}
            </div>
          )}
        </div>

        {/* 품목 */}
        <ul className="m-0 mb-[24px] list-none border-y border-line p-0">
          {order.items.map((item) => (
            <li key={item.lineId} className={ITEM_ROW}>
              <div className="min-w-0 flex-1">
                <b className="block text-[15px] font-medium leading-[24px]">{item.productName}</b>
                <span className="num block text-[13px] leading-[20px] text-grey">
                  {item.optionName} × {item.quantity}
                </span>
              </div>
              <b className="num shrink-0 text-[15px] font-medium">{formatKRW(item.lineSubtotal)}</b>
            </li>
          ))}
        </ul>

        {/* 결제 정보 + 배송지 */}
        <div className="mb-[28px] grid grid-cols-2 gap-[20px] max-sm:grid-cols-1">
          <div className={BOX}>
            <SectionTitle>{t("payment")}</SectionTitle>
            <TotalRow label={t("subtotal")} value={formatKRW(order.totals.itemsSubtotal)} />
            <TotalRow label={t("shipping")} value={formatKRW(order.totals.shippingFee)} />
            <TotalRow label={t("discount")} value={`−${formatKRW(order.totals.discountTotal)}`} />
            <div className="mt-[10px] flex items-baseline justify-between border-t border-line pt-[10px]">
              <span className="text-[15px] font-medium leading-[32px]">{t("grandTotal")}</span>
              <b className="num text-[20px] font-medium leading-[32px]">
                {formatKRW(order.totals.grandTotal)}
              </b>
            </div>
          </div>
          <div className={BOX}>
            <SectionTitle>{t("shippingTo")}</SectionTitle>
            <p className="m-0 text-[14px] leading-[24px] text-ink">
              <b>{order.shippingAddress.recipient}</b>
              <br />({order.shippingAddress.zipcode}) {order.shippingAddress.addr1}{" "}
              {order.shippingAddress.addr2 ?? ""}
              <br />
              {order.shippingAddress.phone}
            </p>
          </div>
        </div>

        <OrderActions
          order={order}
          onDone={async () => {
            setData(await fetchDetail());
          }}
        />

        <ClaimsList claims={claims} />

        <ButtonLink href="/orders" variant="text" size="sm">
          ← {t("title")}
        </ButtonLink>
      </div>
    </PageShell>
  );
}

/** 결제 직후 띠 — 이 화면의 라임은 이 띠 하나, 위 글자는 먹색 */
function WelcomeBand({ orderNo }: { orderNo: ReactNode }) {
  const tp = useTranslations("pay.result");
  return (
    <div className="mb-[24px] flex flex-wrap items-baseline justify-between gap-[8px_16px] bg-lime px-[16px] py-[14px] text-ink">
      <b className="block text-[17px] font-medium">{tp("done")}</b>
      <span className="num text-[13px]">{orderNo}</span>
    </div>
  );
}

/* ─── 불러오는 동안 ─────────────────────────── */

interface OrderDetailLoadingProps {
  welcome?: boolean;
}

/** 주문 상세 뼈대 — 상태 뱃지 / 품목 한 줄 / 결제 정보·배송지 두 상자가 실제와 같은 자리·높이 */
function OrderDetailLoading({ welcome = false }: OrderDetailLoadingProps) {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  return (
    <PageShell title={t("detailTitle")} meta={<Skeleton inline className="h-[12px] w-[132px]" />}>
      <div role="status" aria-label={tc("loading")} aria-busy="true" className="max-w-[860px]">
        {welcome && (
          // 띠 글은 정해져 있어 그대로 그리고, 아직 모르는 주문번호만 같은 길이로 비워 둔다
          <WelcomeBand
            orderNo={
              <span aria-hidden="true" className="invisible">
                {t("welcomeOrderNo", { orderNo: "00000000-000000" })}
              </span>
            }
          />
        )}

        <div className="mb-[24px] flex">
          <Skeleton shape="badge" className="h-[22px] w-[64px]" />
        </div>

        <ul className="m-0 mb-[24px] list-none border-y border-line p-0">
          <li className={ITEM_ROW}>
            <div className="min-w-0 flex-1">
              <span className="flex h-[24px] items-center">
                <Skeleton className="h-[14px] w-[180px] max-w-full" />
              </span>
              <span className="flex h-[20px] items-center">
                <Skeleton className="h-[12px] w-[88px]" />
              </span>
            </div>
            <Skeleton className="h-[14px] w-[64px]" />
          </li>
        </ul>

        <div className="mb-[28px] grid grid-cols-2 gap-[20px] max-sm:grid-cols-1">
          <div className={BOX}>
            <SkeletonLine height="h-[24px]" width="w-[56px]" className="mb-[12px]" />
            {["w-[48px]", "w-[40px]", "w-[32px]"].map((w) => (
              <div key={w} className="flex h-[32px] items-center justify-between">
                <Skeleton className={`h-[12px] ${w}`} />
                <Skeleton className="h-[12px] w-[56px]" />
              </div>
            ))}
            <div className="mt-[10px] flex h-[43px] items-center justify-between border-t border-line pt-[10px]">
              <Skeleton className="h-[14px] w-[72px]" />
              <Skeleton className="h-[18px] w-[96px]" />
            </div>
          </div>
          <div className={BOX}>
            <SkeletonLine height="h-[24px]" width="w-[40px]" className="mb-[12px]" />
            <SkeletonLine height="h-[24px]" width="w-[56px]" />
            <SkeletonLine height="h-[24px]" width="w-[220px]" />
            <SkeletonLine height="h-[24px]" width="w-[104px]" />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

/** 글 한 줄 자리 — 줄 높이(height) 안에 막대(width) 하나 */
function SkeletonLine({
  height,
  width,
  className = "",
}: {
  height: string;
  width: string;
  className?: string;
}) {
  return (
    <span className={`flex items-center ${height} ${className}`}>
      <Skeleton className={`h-[12px] max-w-full ${width}`} />
    </span>
  );
}

/* ─── 주문 관리 ─────────────────────────────── */

function OrderActions({ order, onDone }: { order: Order; onDone: () => Promise<void> }) {
  const t = useTranslations("orders");
  const tc = useTranslations("claims");

  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelFormOpen, setCancelFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 결제 전 → 바로 취소(한 번 더 묻는다). 결제했고 아직 안 보냄 → 취소 요청(사유 폼이 확인 단계)
  const canCancel = order.status === "pending";
  const canRequestCancel =
    (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded") &&
    BEFORE_SHIPMENT.includes(order.fulfillmentStatus);

  if (!canCancel && !canRequestCancel) return null;

  function errText(err: unknown): string {
    return err instanceof ApiClientError && CLAIM_ERRORS.includes(err.code)
      ? tc(`error.${err.code}`)
      : tc("error.default");
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
    <section className={`mb-[28px] ${BOX}`}>
      <SectionTitle>{t("manage")}</SectionTitle>

      <div className="flex flex-col gap-[16px]">
        {error && <ErrorNote text={error} />}

        {canCancel &&
          (!confirmCancel ? (
            <Button
              variant="danger"
              size="sm"
              className="self-start"
              disabled={busy}
              onClick={() => {
                setError(null);
                setConfirmCancel(true);
              }}
            >
              {t("cancelOrder")}
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-[8px]">
              <span className="w-full text-[15px] text-ink">{t("cancelConfirm")}</span>
              <Button variant="danger" size="sm" disabled={busy} onClick={handleCancel}>
                {busy ? "…" : t("cancelYes")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmCancel(false)}
              >
                {t("cancelNo")}
              </Button>
            </div>
          ))}

        {canRequestCancel &&
          (!cancelFormOpen ? (
            <Button
              variant="danger"
              size="sm"
              className="self-start"
              disabled={busy}
              onClick={() => {
                setError(null);
                setCancelFormOpen(true);
              }}
            >
              {t("requestCancel")}
            </Button>
          ) : (
            <CancelRequestForm
              order={order}
              busy={busy}
              setBusy={setBusy}
              onClose={() => setCancelFormOpen(false)}
              onError={setError}
              errText={errText}
              onDone={async () => {
                setCancelFormOpen(false);
                await onDone();
              }}
            />
          ))}
      </div>
    </section>
  );
}

/* ─── 취소 요청 폼 ───────────────────────────── */

interface CancelRequestFormProps {
  order: Order;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onClose: () => void;
  onError: (m: string | null) => void;
  errText: (err: unknown) => string;
  onDone: () => Promise<void>;
}

/** 결제했고 아직 안 보낸 주문의 취소 요청 — 백엔드에는 클레임(createClaim)으로 간다. 사유 값은 API 값 그대로, 화면 이름만 claims.reasonCode.* */
function CancelRequestForm({
  order,
  busy,
  setBusy,
  onClose,
  onError,
  errText,
  onDone,
}: CancelRequestFormProps) {
  const tc = useTranslations("claims");

  const [reasonCode, setReasonCode] = useState<ReasonCode>("단순변심");
  const [reasonDetail, setReasonDetail] = useState("");
  const [scope, setScope] = useState<"full" | "partial">("full");
  // 일부 취소: lineId → 취소 수량 (0 = 안 고름)
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
      {/* 사유 */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-[12px] p-0 text-[16px] font-medium text-ink">
          {tc("formTitle")}
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
        <label htmlFor="cancel-detail" className="mb-[6px] block text-[13px] text-grey">
          {tc("detail")}
        </label>
        <textarea
          id="cancel-detail"
          value={reasonDetail}
          onChange={(e) => setReasonDetail(e.target.value)}
          rows={3}
          placeholder={tc("detailPlaceholder")}
          className="w-full resize-y border border-line bg-paper px-[12px] py-[11px] text-[16px] text-ink outline-none transition-colors placeholder:text-grey/50 focus:border-ink"
        />
      </div>

      {/* 범위 */}
      <fieldset className="m-0 border-0 p-0">
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

      {/* 일부 취소 — 줄마다 수량 */}
      {scope === "partial" && (
        <ul className="m-0 list-none border border-line p-0">
          {order.items.map((item) => {
            const value = qty[item.lineId] ?? 0;
            return (
              <li
                key={item.lineId}
                className="flex flex-wrap items-center gap-[12px] border-b border-line px-[14px] py-[12px] last:border-b-0"
              >
                <div className="min-w-[140px] flex-1">
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

      <div className="flex flex-wrap items-center gap-[8px_20px]">
        <Button type="submit" variant="danger" size="sm" disabled={busy || partialInvalid}>
          {busy ? "…" : tc("submit")}
        </Button>
        <Button type="button" variant="text" size="sm" disabled={busy} onClick={onClose}>
          {tc("cancel")}
        </Button>
      </div>

      <p className="m-0 text-[13px] leading-[1.6] text-grey">{tc("cardNote")}</p>
    </form>
  );
}

/* ─── 취소·환불 내역 ─────────────────────────── */

function ClaimsList({ claims }: { claims: Claim[] }) {
  const tc = useTranslations("claims");

  if (claims.length === 0) return null;

  return (
    <section className={`mb-[28px] ${BOX} pb-0`}>
      <SectionTitle>{tc("historyTitle")}</SectionTitle>
      <ul className="m-0 list-none p-0">
        {claims.map((c) => (
          <li key={c.claimId} className="border-t border-line py-[14px]">
            <div className="mb-[6px] flex flex-wrap items-center gap-[10px]">
              <Badge tone={CLAIM_STATUS_TONE[c.status]}>{tc(`status.${c.status}`)}</Badge>
              <b className="text-[15px] font-medium">{tc(`reasonCode.${c.reasonCode}`)}</b>
              <b className="num ml-auto text-[15px] font-medium">{formatKRW(c.refundAmount)}</b>
            </div>
            {c.reasonDetail && (
              <p className="m-0 mb-[6px] text-[13px] leading-[1.6] text-ink-soft">
                {c.reasonDetail}
              </p>
            )}
            <div className="flex flex-wrap gap-x-[16px] gap-y-[2px] text-[13px] text-grey">
              <span className="num">{tc("refundDue", { date: formatDateKST(c.refundDueAt) })}</span>
              <span className="num">{tc("requestedAt", { date: formatDateKST(c.createdAt) })}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─── 작은 조각 ─────────────────────────────── */

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="m-0 mb-[12px] text-[14px] font-medium leading-[24px] text-ink">{children}</h2>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-[32px] items-center justify-between gap-[12px]">
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

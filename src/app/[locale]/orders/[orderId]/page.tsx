"use client";

import { Suspense, use, useCallback, useEffect, useState, type ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import CancelRequestForm from "@/components/orders/CancelRequestForm";
import { claimErrorKey } from "@/components/orders/claimError";
import ClaimHistory from "@/components/orders/ClaimHistory";
import ExchangeRequestForm from "@/components/orders/ExchangeRequestForm";
import ReturnRequestForm from "@/components/orders/ReturnRequestForm";
import ShippingAddressBox from "@/components/orders/ShippingAddressBox";
import TrackingLine from "@/components/orders/TrackingLine";
import { useClaimKeys } from "@/components/orders/useClaimKeys";
import { useSubmitLock } from "@/components/orders/useSubmitLock";
import LoginRequired from "@/components/shell/LoginRequired";
import PageShell from "@/components/shell/PageShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import Skeleton from "@/components/ui/Skeleton";
import { BUSINESS } from "@/constants/site";
import { trackPurchase } from "@/lib/analytics";
import { useAnalyticsConsent } from "@/lib/analytics-consent";
import { api, ApiClientError, isAuthRequired, isNotFound } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { methodFromLabel, paymentEnv } from "@/lib/payment/providers";
import { isLiveClientKey } from "@/lib/payment/toss";
import { formatDateTimeKST, formatKRW, itemName } from "@/lib/format";
import {
  canRequestCancel,
  canRequestAfterDelivery,
  hasOpenAfterDelivery,
  isShippedPaid,
  openAfterDeliveryType,
} from "@/lib/claims/rules";
import type { Claim, ClaimType, Order } from "@/types";

import {
  isShipDelayed,
  ORDER_STATE_TONE,
  ORDER_STEPS,
  orderState,
  orderStepIndex,
} from "../orderState";

// 실제 화면과 뼈대가 같은 크기가 되도록 상자·줄 틀을 한 곳에서 쓴다
const BOX = "border border-line p-[16px]";
const ITEM_ROW = "flex items-center gap-[16px] border-b border-line py-[14px] last:border-b-0";

interface OrderDetailData {
  order: Order;
  claims: Claim[];
  /** 받은 때 기준으로 발송기한이 지났나 — 그리는 중에 시계를 읽지 않게 받을 때 한 번 정한다 */
  isShipDelayed: boolean;
}

/** 결제 대기 주문 취소가 막힌 이유 중 그 버튼의 말로 알리는 서버 코드 — 메시지 `orders.cancelError.{code}` */
const PENDING_CANCEL_ERRORS: readonly string[] = [
  "PAYMENT_GATEWAY_UNAVAILABLE",
  "PAYMENT_IN_PROGRESS",
];
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
  const tPay = useTranslations("pay");
  const locale = useLocale();
  const { status, recheckSession } = useAuth();
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";

  const [data, setData] = useState<OrderDetailData | null>(null);
  // 못 불러오면 뼈대에 멈추지 않고 이유와 다시 시도할 길을 보여 준다. 없는 주문(남의 주문 포함)은 다시 해도 같아 시도 버튼이 없다
  const [loadFailed, setLoadFailed] = useState<"notFound" | "error" | null>(null);

  // 취소 내역을 못 받아도 주문은 보여 준다(내역만 비운다)
  const fetchDetail = useCallback(async (): Promise<OrderDetailData> => {
    const [order, claims] = await Promise.all([
      api.getOrder(orderId),
      api.listClaims(orderId).catch(() => [] as Claim[]),
    ]);
    const now = Date.now();
    return { order, claims, isShipDelayed: isShipDelayed(order, now) };
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
          const failure = isNotFound(err) ? "notFound" : "error";
          setLoadFailed(failure);
        }),
    [fetchDetail, recheckSession],
  );

  useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  // 결제 직후 완료 화면에서 구매를 한 번 센다 — 실결제 키일 때만(테스트 키 결제는 돈이 움직이지 않아 매출이 아니다)
  // 완료 화면에서 처음 '허용'을 눌러도 센다 — 도구 대기열은 허용 직후 만들어지므로 다음 틱에 보낸다
  const paidOrder = data?.order.paymentStatus === "paid" ? data.order : null;
  const consent = useAnalyticsConsent();
  useEffect(() => {
    if (!welcome || !paidOrder || consent !== "granted" || !isLivePayment()) return;
    const quantity = paidOrder.items.reduce((sum, item) => sum + item.quantity, 0);
    const purchase = { orderNo: paidOrder.orderNo, value: paidOrder.totals.grandTotal, quantity };
    const timer = setTimeout(() => {
      trackPurchase(purchase);
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [welcome, paidOrder, consent]);

  // 신청·철회·배송지 변경 뒤 다시 읽기 — 못 받으면 보던 화면을 그대로 두고 null(던지지 않는다: 이미 된 일을 실패로 보이지 않게)
  const reload = useCallback(async (): Promise<OrderDetailData | null> => {
    try {
      const next = await fetchDetail();
      setData(next);
      return next;
    } catch (err) {
      if (isAuthRequired(err)) void recheckSession();
      return null;
    }
  }, [fetchDetail, recheckSession]);

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
    const failedMessageKey = loadFailed === "notFound" ? "notFound" : "detailLoadError";
    return (
      <PageShell title={t("detailTitle")}>
        <div className="flex max-w-[400px] flex-col items-start gap-[16px]">
          <p role="alert" className="m-0 text-[15px] text-ink">
            {t(failedMessageKey)}
          </p>
          {loadFailed === "error" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setLoadFailed(null);
                void load();
              }}
            >
              {tc("retry")}
            </Button>
          )}
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

  const { order, claims, isShipDelayed: shipDelayed } = data;
  const openClaim = openAfterDeliveryType(claims);
  const state = orderState({ ...order, openClaim });
  const step = orderStepIndex(order);
  const totalQty = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const methodId = methodFromLabel(order.paymentMethod ?? null);
  const methodName = methodId ? tPay(`method.${methodId}`) : order.paymentMethod;

  return (
    <PageShell title={t("detailTitle")} meta={order.orderNo}>
      <div className="max-w-[860px]">
        {welcome && <WelcomeBand orderNo={order.orderNo} />}

        {/* 상태 — 세 축을 이름 하나로 */}
        <div className="mb-[24px] flex flex-col items-start gap-[8px]">
          <Badge tone={ORDER_STATE_TONE[state]}>{t(`state.${state}`)}</Badge>
          {/* 결제 대기 — 결제를 이어 갈 길이 주 버튼(UX 리뷰 E3). 주문서가 이 브라우저의 보류 주문을 이어 쓴다 */}
          {state === "awaitingPayment" && (
            <>
              <p className="m-0 text-[13px] text-grey">
                {t("payWithin")} <PayDeadline dueAt={order.paymentDueAt} />
              </p>
              <ButtonLink href={`/checkout?qty=${String(totalQty)}`} size="sm">
                {t("payNow")}
              </ButtonLink>
            </>
          )}
          {/* 진행 단계 — 상태 칩이 반품·환불을 말할 때도 배송이 어디까지 왔는지 보인다(UX 리뷰 E5) */}
          {step !== null && <OrderSteps current={step} />}
          {/* 안내가 '아래 주문 취소 요청'을 가리키므로 그 버튼이 있을 때만(남은 수량이 모두 취소 중이면 없다) */}
          {shipDelayed && canRequestCancel(order, claims) && (
            <p className="m-0 max-w-[560px] text-[13px] leading-[1.6] text-ink-soft">
              {t("shipDelayed")}
            </p>
          )}
          {order.carrier && order.trackingNumber && (
            <TrackingLine
              carrier={order.carrier}
              trackingNumber={order.trackingNumber}
              trackingUrl={order.trackingUrl}
            />
          )}
        </div>

        {/* 품목 */}
        <ul className="m-0 mb-[24px] list-none border-y border-line p-0">
          {order.items.map((item) => (
            <li key={item.lineId} className={ITEM_ROW}>
              <div className="min-w-0 flex-1">
                <b className="block text-[15px] font-medium leading-[24px]">
                  {itemName(item, locale)}
                </b>
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
            <TotalRow
              label={t("shipping")}
              value={
                order.totals.shippingFee === 0 ? t("free") : formatKRW(order.totals.shippingFee)
              }
            />
            {order.totals.discountTotal > 0 && (
              <TotalRow label={t("discount")} value={`−${formatKRW(order.totals.discountTotal)}`} />
            )}
            <div className="mt-[10px] flex items-baseline justify-between border-t border-line pt-[10px]">
              <span className="text-[15px] font-medium leading-[32px]">{t("grandTotal")}</span>
              <b className="num text-[20px] font-medium leading-[32px]">
                {formatKRW(order.totals.grandTotal)}
              </b>
            </div>
            {/* 결제수단·결제일시·영수증 — 결제한 주문만 */}
            {methodName && <TotalRow label={t("paymentMethod")} value={methodName} />}
            {order.paidAt !== undefined && (
              <TotalRow label={t("paidAt")} value={formatDateTimeKST(order.paidAt)} />
            )}
            {order.receiptUrl && (
              <a
                href={order.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-[4px] inline-flex min-h-[44px] items-center text-[14px] text-ink underline underline-offset-[3px]"
              >
                {t("receipt")}
              </a>
            )}
          </div>
          <ShippingAddressBox
            order={order}
            onChanged={(next) => setData((prev) => (prev ? { ...prev, order: next } : prev))}
            onFailed={async () => {
              await reload();
            }}
          />
        </div>

        <OrderActions order={order} claims={claims} reload={reload} />

        <ClaimHistory
          claims={claims}
          items={order.items}
          onChanged={async () => {
            await reload();
          }}
        />

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

interface OrderActionsProps {
  order: Order;
  claims: Claim[];
  /** 주문·내역을 다시 읽어 화면에 반영하고 돌려준다(못 받으면 null) */
  reload: () => Promise<OrderDetailData | null>;
}

function OrderActions({ order, claims, reload }: OrderActionsProps) {
  const t = useTranslations("orders");
  const tc = useTranslations("claims");

  // 결제 전 주문 취소 — 연타의 두 번째가 '취소할 수 없어요'로 뜨지 않게 같은 잠금을 쓴다(키는 쓰지 않는다)
  const { busy, run } = useSubmitLock();
  const [confirmCancel, setConfirmCancel] = useState(false);
  // 신청 폼은 한 번에 하나만 펼친다(취소·반품·교환)
  const [openForm, setOpenForm] = useState<ClaimType | null>(null);
  // 신청 종류마다 멱등키 하나 — 폼이 닫혀도 남고, 신청이 됐을 때만 바뀐다
  const keys = useClaimKeys();
  const [error, setError] = useState<string | null>(null);

  // 결제 전 → 바로 취소(한 번 더 묻는다). 결제했고 아직 안 보냄 → 취소 요청(사유 폼이 확인 단계)
  // 서버(결제 전 취소)와 같은 조건 — 멈춘 자동 환불(status pending·결제 refunding)은 결제 전이 아니다
  const canCancel = order.paymentStatus === "pending";
  const canCancelPaid = canRequestCancel(order, claims);
  // 받은 뒤 → 반품·교환 신청(조건이 같다 — 기한·진행 중 신청은 rules 가 본다)
  // 기한은 화면을 연 때 기준(렌더마다 시계를 읽지 않는다)
  const [now] = useState(Date.now);
  const canAfterDelivery = canRequestAfterDelivery(order, claims, now);

  const open = (form: ClaimType) => {
    setError(null);
    setOpenForm(form);
  };
  const closeForm = () => setOpenForm(null);
  const formDone = (type: ClaimType) => async () => {
    keys.renew(type);
    setOpenForm(null);
    await reload();
  };
  // 실패로 보여도 서버에선 됐을 수 있다(응답만 늦음) — 다시 읽어 그 종류의 새 신청이 생겼으면 된 것으로 본다
  const formFailed = (type: ClaimType) => async () => {
    const known = new Set(claims.filter((c) => c.type === type).map((c) => c.claimId));
    const next = await reload();
    if (next?.claims.some((c) => c.type === type && !known.has(c.claimId))) {
      keys.renew(type);
      setOpenForm(null);
    }
  };

  // 발송된 결제 주문은 취소 버튼이 사라진 자리에 이유와 다음 길(반품·교환, 안 되면 메일)을 둔다 — 막다른 화면이 되지 않게
  const isShipped = isShippedPaid(order);
  // '받은 뒤 반품·교환' 안내는 배송 중일 때만 — 받은 뒤엔 버튼이 바로 있거나, 이미 신청이 진행 중이다
  const showInTransitNote =
    isShipped && order.fulfillmentStatus === "shipped" && !hasOpenAfterDelivery(claims);

  if (!canCancel && !canCancelPaid && !canAfterDelivery && !isShipped) return null;

  const handleCancel = () =>
    run(async () => {
      setError(null);
      try {
        await api.cancelOrder(order.orderId);
        setConfirmCancel(false);
        await reload();
      } catch (err) {
        // 결제 전 취소에서만 나는 막힘(토스를 못 읽음·승인 처리 중)은 이 버튼의 말로 — 취소 요청(환불)의 503 과 뜻이 다르다
        const code = err instanceof ApiClientError ? err.code : "";
        let errorMessage: string;
        if (PENDING_CANCEL_ERRORS.includes(code)) {
          const messageKey = `cancelError.${code}`;
          errorMessage = t(messageKey);
        } else {
          const errorKey = claimErrorKey(err);
          errorMessage = tc(errorKey);
        }
        setError(errorMessage);
        // 토스가 이미 승인해 서버가 결제완료로 확정했다 — 다시 읽어 결제된 주문(취소 요청 버튼)을 보여 준다
        if (err instanceof ApiClientError && err.code === "ORDER_ALREADY_PAID") {
          setConfirmCancel(false);
          await reload();
        }
      }
    });

  return (
    <section className={`mb-[28px] ${BOX}`}>
      <SectionTitle>{t("manage")}</SectionTitle>

      <div className="flex flex-col gap-[16px]">
        {showInTransitNote && (
          <p className="m-0 text-[14px] leading-[1.6] text-ink">{t("shippedNoCancel")}</p>
        )}
        {error && <ErrorNote text={error} />}

        {/* 결제 대기 주문의 취소는 보조 — 주 버튼은 위 '이 주문 결제하기'(UX 리뷰 E3) */}
        {canCancel &&
          (!confirmCancel ? (
            <Button
              variant="secondary"
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

        {canCancelPaid &&
          (openForm !== "cancel" ? (
            <Button
              variant="danger"
              size="sm"
              className="self-start"
              disabled={busy}
              onClick={() => open("cancel")}
            >
              {t("requestCancel")}
            </Button>
          ) : (
            <CancelRequestForm
              order={order}
              claims={claims}
              idempotencyKey={keys.keyFor("cancel")}
              onClose={closeForm}
              onDone={formDone("cancel")}
              onFailed={formFailed("cancel")}
            />
          ))}

        {canAfterDelivery && (
          <>
            <div className="flex flex-wrap gap-[8px]">
              {openForm !== "return" && (
                <Button variant="secondary" size="sm" onClick={() => open("return")}>
                  {t("requestReturn")}
                </Button>
              )}
              {openForm !== "exchange" && (
                <Button variant="secondary" size="sm" onClick={() => open("exchange")}>
                  {t("requestExchange")}
                </Button>
              )}
            </div>
            {openForm === "return" && (
              <ReturnRequestForm
                order={order}
                claims={claims}
                idempotencyKey={keys.keyFor("return")}
                onClose={closeForm}
                onDone={formDone("return")}
                onFailed={formFailed("return")}
              />
            )}
            {openForm === "exchange" && (
              <ExchangeRequestForm
                order={order}
                claims={claims}
                idempotencyKey={keys.keyFor("exchange")}
                onClose={closeForm}
                onDone={formDone("exchange")}
                onFailed={formFailed("exchange")}
              />
            )}
          </>
        )}

        {isShipped && <ContactNote />}
      </div>
    </section>
  );
}

/* ─── 작은 조각 ─────────────────────────────── */

/** 화면에서 안 되는 일(기한 지난 반품·진행 중인 일 묻기)의 길 — 고객센터 메일 */
function ContactNote() {
  const t = useTranslations("orders");
  return (
    <p className="m-0 text-[13px] leading-[1.6] text-grey">
      {t.rich("contact", {
        email: BUSINESS.email,
        mail: (chunks) => (
          <a
            href={`mailto:${BUSINESS.email}`}
            className="text-ink underline underline-offset-[3px]"
          >
            {chunks}
          </a>
        ),
      })}
    </p>
  );
}

/** 진행 단계 막대 — 결제완료 → 상품준비중 → 배송중 → 배송완료, 지금 단계까지 먹색 */
function OrderSteps({ current }: { current: number }) {
  const t = useTranslations("orders");
  return (
    <ol
      aria-label={t("progressLabel")}
      className="m-0 mt-[4px] flex w-full max-w-[560px] list-none gap-[4px] p-0"
    >
      {ORDER_STEPS.map((s, i) => {
        const isDone = i <= current;
        return (
          <li
            key={s}
            aria-current={i === current ? "step" : undefined}
            className="flex flex-1 flex-col gap-[6px]"
          >
            <span
              aria-hidden="true"
              className={`h-[3px] rounded-full ${isDone ? "bg-ink" : "bg-line"}`}
            />
            <span className={`text-[12px] leading-[16px] ${isDone ? "text-ink" : "text-grey"}`}>
              {t(`state.${s}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** 결제 마감까지 남은 분 — 처음 그릴 때 한 번 센다 */
function PayDeadline({ dueAt }: { dueAt?: number }) {
  const t = useTranslations("orders");
  const [now] = useState(Date.now);
  if (dueAt === undefined) return null;
  const leftMs = dueAt - now;
  const leftMinutes = leftMs / 60_000;
  const minutes = Math.ceil(leftMinutes);
  return <>{minutes > 0 ? t("payLeft", { minutes }) : t("payExpiredSoon")}</>;
}

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

/* ─── 내부 ─────────────────────────── */

/** 이 빌드가 실결제 키(`live_`)로 결제를 받는가 */
function isLivePayment(): boolean {
  const { tossClientKey } = paymentEnv();
  return isLiveClientKey(tossClientKey);
}

"use client";

import { Suspense, use, useCallback, useEffect, useState, type ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import CancelRequestForm from "@/components/orders/CancelRequestForm";
import { claimErrorKey } from "@/components/orders/claimError";
import ClaimHistory from "@/components/orders/ClaimHistory";
import ExchangeRequestForm from "@/components/orders/ExchangeRequestForm";
import ReturnRequestForm from "@/components/orders/ReturnRequestForm";
import TrackingLine from "@/components/orders/TrackingLine";
import { useClaimSubmit } from "@/components/orders/useClaimSubmit";
import LoginRequired from "@/components/shell/LoginRequired";
import PageShell from "@/components/shell/PageShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import Skeleton from "@/components/ui/Skeleton";
import { BUSINESS } from "@/constants/site";
import { api, isAuthRequired, isNotFound } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { formatKRW } from "@/lib/format";
import { canRequestCancel, canRequestReturn, isShippedPaid } from "@/lib/claims/rules";
import type { Claim, Order } from "@/types";

import { ORDER_STATE_TONE, orderState } from "../orderState";

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
  // 못 불러오면 뼈대에 멈추지 않고 이유와 다시 시도할 길을 보여 준다. 없는 주문(남의 주문 포함)은 다시 해도 같아 시도 버튼이 없다
  const [loadFailed, setLoadFailed] = useState<"notFound" | "error" | null>(null);

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
          setLoadFailed(isNotFound(err) ? "notFound" : "error");
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
            {t(loadFailed === "notFound" ? "notFound" : "detailLoadError")}
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
          claims={claims}
          onDone={async () => {
            setData(await fetchDetail());
          }}
        />

        <ClaimHistory
          claims={claims}
          onChanged={async () => {
            setData(await fetchDetail());
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
  onDone: () => Promise<void>;
}

function OrderActions({ order, claims, onDone }: OrderActionsProps) {
  const t = useTranslations("orders");
  const tc = useTranslations("claims");

  // 결제 전 주문 취소 — 연타의 두 번째가 '취소할 수 없어요'로 뜨지 않게 같은 잠금을 쓴다(키는 쓰지 않는다)
  const { busy, run } = useClaimSubmit();
  const [confirmCancel, setConfirmCancel] = useState(false);
  // 신청 폼은 한 번에 하나만 펼친다(취소·반품·교환)
  const [openForm, setOpenForm] = useState<"cancel" | "return" | "exchange" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 결제 전 → 바로 취소(한 번 더 묻는다). 결제했고 아직 안 보냄 → 취소 요청(사유 폼이 확인 단계)
  const canCancel = order.status === "pending";
  const canCancelPaid = canRequestCancel(order, claims);
  // 받은 뒤 → 반품·교환 신청(조건이 같다 — 기한·진행 중 신청은 rules 가 본다)
  // 기한은 화면을 연 때 기준(렌더마다 시계를 읽지 않는다)
  const [now] = useState(Date.now);
  const canReturn = canRequestReturn(order, claims, now);

  const open = (form: "cancel" | "return" | "exchange") => {
    setError(null);
    setOpenForm(form);
  };
  const closeForm = () => setOpenForm(null);
  const formDone = async () => {
    setOpenForm(null);
    await onDone();
  };

  // 발송된 결제 주문은 취소 버튼이 사라진 자리에 이유와 다음 길(반품·교환, 안 되면 메일)을 둔다 — 막다른 화면이 되지 않게
  const isShipped = isShippedPaid(order);

  if (!canCancel && !canCancelPaid && !canReturn && !isShipped) return null;

  const handleCancel = () =>
    run(async () => {
      setError(null);
      try {
        await api.cancelOrder(order.orderId);
        setConfirmCancel(false);
        await onDone();
      } catch (err) {
        setError(tc(claimErrorKey(err)));
      }
    });

  return (
    <section className={`mb-[28px] ${BOX}`}>
      <SectionTitle>{t("manage")}</SectionTitle>

      <div className="flex flex-col gap-[16px]">
        {isShipped && (
          <p className="m-0 text-[14px] leading-[1.6] text-ink">{t("shippedNoCancel")}</p>
        )}
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
              onClose={closeForm}
              onDone={formDone}
            />
          ))}

        {canReturn && (
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
                onClose={closeForm}
                onDone={formDone}
              />
            )}
            {openForm === "exchange" && (
              <ExchangeRequestForm
                order={order}
                claims={claims}
                onClose={closeForm}
                onDone={formDone}
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

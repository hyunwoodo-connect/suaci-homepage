"use client";

import { useState } from "react";

import { useLocale, useTranslations } from "next-intl";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { canWithdraw } from "@/lib/claims/rules";
import { formatDateKST, formatKRW, itemName } from "@/lib/format";
import type { Claim, OrderItem } from "@/types";

import { claimErrorKey } from "./claimError";
import { CLAIM_STATUS_TONE } from "./claimStatus";
import TrackingLine from "./TrackingLine";
import { useSubmitLock } from "./useSubmitLock";

interface ClaimHistoryProps {
  claims: Claim[];
  /** 주문 줄 — 신청마다 어느 상품 몇 개인지 이름을 찾는다(여러 상품 주문) */
  items: OrderItem[];
  /** 철회처럼 내역을 바꾼 뒤 주문·내역을 다시 받는다 */
  onChanged: () => Promise<void>;
}

/** 배송 조회(딜리버리트래커) 상태 코드 — 메시지 `claims.pickup.status.*` 가 있는 것만 이름을 보인다 */
const PICKUP_STATUSES: readonly string[] = [
  "UNKNOWN",
  "INFORMATION_RECEIVED",
  "AT_PICKUP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "ATTEMPT_FAIL",
  "DELIVERED",
  "AVAILABLE_FOR_PICKUP",
  "EXCEPTION",
];

/**
 * 주문의 취소·반품·교환 내역 — 상태 이름은 종류마다(`claims.status.{type}.{status}`, 관리 툴·메일과 같은 이름).
 * 돈이 오가는 줄(취소·반품)은 금액·환불 기한, 교환은 새 제품 택배사·송장과 '배송 조회'를 보인다
 */
export default function ClaimHistory({ claims, items, onChanged }: ClaimHistoryProps) {
  const tc = useTranslations("claims");

  if (claims.length === 0) return null;

  return (
    <section className="mb-[28px] border border-line p-[16px] pb-0">
      <h2 className="m-0 mb-[12px] text-[14px] font-medium leading-[24px] text-ink">
        {tc("historyTitle")}
      </h2>
      <ul className="m-0 list-none p-0">
        {claims.map((c) => (
          <ClaimRow key={c.claimId} claim={c} items={items} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function ClaimRow({
  claim: c,
  items,
  onChanged,
}: {
  claim: Claim;
  items: OrderItem[];
  onChanged: () => Promise<void>;
}) {
  const tc = useTranslations("claims");
  const locale = useLocale();
  // 철회가 막힌 이유 — 다시 받은 줄에 철회 버튼이 사라져도 이유는 남긴다
  const [error, setError] = useState<string | null>(null);
  const tr = useTranslations("returns");
  const te = useTranslations("exchanges");
  const isExchange = c.type === "exchange";
  const returnFee =
    c.type === "return" && c.returnShippingFee > 0 && formatKRW(c.returnShippingFee);
  const shippingBack =
    c.type === "return" && c.refundedShipping > 0 && formatKRW(c.refundedShipping);
  // 반품은 회수 확인 뒤 환불 중일 때만 기한을 보인다(취소는 늘 보여 왔다)
  const refundDueDate =
    c.refundDueAt !== undefined &&
    (c.type === "cancel" || (c.type === "return" && isRefunding(c))) &&
    formatDateKST(c.refundDueAt);
  const requestedDate = formatDateKST(c.createdAt);
  // 모르는 상태 코드는 이름 없이(송장·조회 링크만)
  const pickupStatusLabel =
    c.pickupStatus && PICKUP_STATUSES.includes(c.pickupStatus)
      ? tc(`pickup.status.${c.pickupStatus}`)
      : undefined;

  return (
    <li className="border-t border-line py-[14px]">
      <div className="mb-[6px] flex flex-wrap items-center gap-[10px]">
        <Badge tone={CLAIM_STATUS_TONE[c.type][c.status]}>
          {tc(`status.${c.type}.${c.status}`)}
        </Badge>
        <b className="text-[15px] font-medium">
          {tc(`type.${c.type}`)} · {tc(`reasonCode.${c.reasonCode}`)}
        </b>
        {/* 교환은 돈이 오가지 않는다 — 금액 대신 수량 */}
        <b className="num ml-auto text-[15px] font-medium">
          {isExchange
            ? te("qty", { n: c.lines.reduce((sum, l) => sum + l.quantity, 0) })
            : formatKRW(c.refundAmount)}
        </b>
      </div>
      <p className="num m-0 mb-[6px] text-[13px] leading-[1.6] text-ink">
        {c.lines
          .map((l) => {
            const item = items.find((i) => i.lineId === l.lineId);
            return `${item ? itemName(item, locale) : ""} × ${String(l.quantity)}`;
          })
          .join(" · ")}
      </p>
      {c.reasonDetail && (
        <p className="m-0 mb-[6px] text-[13px] leading-[1.6] text-ink-soft">{c.reasonDetail}</p>
      )}
      {c.status === "rejected" && c.rejectReason && (
        <p className="m-0 mb-[6px] text-[13px] leading-[1.6] text-ink">
          {tc("rejectReason", { reason: c.rejectReason })}
        </p>
      )}
      {/* 회수 송장 — 회사가 택배사에 회수를 접수하면 보인다. 상태는 배송 조회가 채운다 */}
      {c.type !== "cancel" && c.pickupCarrier && c.pickupTrackingNumber && (
        <div className="mb-[6px] flex flex-col gap-[4px]">
          <p className="m-0 text-[13px] text-ink">
            {tc("pickup.title")}
            {pickupStatusLabel && ` · ${pickupStatusLabel}`}
          </p>
          <TrackingLine
            carrier={c.pickupCarrier}
            trackingNumber={c.pickupTrackingNumber}
            trackingUrl={c.pickupTrackingUrl}
          />
        </div>
      )}
      {isExchange && c.carrier && c.trackingNumber && (
        <div className="mb-[6px]">
          <TrackingLine
            carrier={c.carrier}
            trackingNumber={c.trackingNumber}
            trackingUrl={c.trackingUrl}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-x-[16px] gap-y-[2px] text-[13px] text-grey">
        {returnFee && <span className="num">{tr("returnFee", { amount: returnFee })}</span>}
        {shippingBack && (
          <span className="num">{tr("shippingBack", { amount: shippingBack })}</span>
        )}
        {refundDueDate && <span className="num">{tc("refundDue", { date: refundDueDate })}</span>}
        <span className="num">{tc("requestedAt", { date: requestedDate })}</span>
        {(c.photoCount ?? 0) > 0 && (
          <span className="num">{tc("photos.count", { n: c.photoCount ?? 0 })}</span>
        )}
      </div>
      {c.status === "requested" && c.type !== "cancel" && (
        <p className="m-0 mt-[6px] text-[13px] leading-[1.6] text-grey">
          {c.type === "return" ? tr("after") : te("after")}
        </p>
      )}
      {error && (
        <p role="alert" className="m-0 mt-[10px] text-[14px] text-alert">
          {error}
        </p>
      )}
      {canWithdraw(c) && <WithdrawControl claim={c} onChanged={onChanged} onError={setError} />}
    </li>
  );
}

/** 신청 상태 반품·교환의 '신청 철회' — 되돌릴 수 없어 한 번 더 묻는다. 철회해도 기한 안이면 다시 신청할 수 있다 */
interface WithdrawControlProps {
  claim: Claim;
  onChanged: () => Promise<void>;
  onError: (message: string | null) => void;
}

function WithdrawControl({ claim, onChanged, onError }: WithdrawControlProps) {
  const tc = useTranslations("claims");
  const [confirming, setConfirming] = useState(false);
  // 연타가 두 번 가지 않게 같은 잠금(철회는 멱등키가 없다 — 두 번째는 CLAIM_NOT_WITHDRAWABLE)
  const { busy, run } = useSubmitLock();

  const withdraw = () =>
    run(async () => {
      onError(null);
      try {
        await api.withdrawClaim(claim.orderId, claim.claimId);
      } catch (err) {
        const errorKey = claimErrorKey(err);
        const errorMessage = tc(errorKey);
        onError(errorMessage);
      }
      // 성공이든 이미 처리가 시작됐든 지금 상태를 다시 받아 보여 준다
      await onChanged();
    });

  return (
    <div className="mt-[10px] flex flex-col items-start gap-[8px]">
      {!confirming ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            onError(null);
            setConfirming(true);
          }}
        >
          {tc("withdraw")}
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-[8px]">
          <span className="w-full text-[14px] leading-[1.6] text-ink">{tc("withdrawConfirm")}</span>
          <Button
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={() => {
              void withdraw();
            }}
          >
            {busy ? "…" : tc("withdrawYes")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            {tc("withdrawNo")}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── 내부 ─────────────────────────── */

/** 회수 확인 뒤 환불이 진행 중인 반품(서버 재시도 포함) */
function isRefunding(c: Claim): boolean {
  return c.status === "approved" || c.status === "failed";
}

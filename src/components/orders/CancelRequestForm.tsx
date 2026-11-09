"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { cancelQuote, remainingQty } from "@/lib/claims/rules";
import { formatKRW } from "@/lib/format";
import { REASON_CODES, type Claim, type Order, type ReasonCode } from "@/types";

import { claimErrorKey } from "./claimError";
import DetailField from "./DetailField";
import LinesPicker from "./LinesPicker";
import ReasonPicker from "./ReasonPicker";
import { useSubmitLock } from "./useSubmitLock";
import { useLineSelection } from "./useLineSelection";

interface CancelRequestFormProps {
  order: Order;
  claims: Claim[];
  /** 주문 상세가 든 이 종류의 멱등키 — 폼을 닫았다 열어도 같고, 신청이 돼야 바뀐다 */
  idempotencyKey: string;
  onClose: () => void;
  /** 신청이 됐다 */
  onDone: () => Promise<void>;
  /** 신청이 막혔거나 응답을 못 받았다 — 주문·내역을 다시 읽는다(서버에선 됐을 수 있다) */
  onFailed: () => Promise<void>;
}

/**
 * 결제했고 아직 안 보낸 주문의 취소 요청 — 백엔드에는 클레임(createClaim)으로 가고 서버가 바로 환불한다.
 * 이미 취소·환불된 수량은 고를 수 없다(남은 수량까지)
 */
export default function CancelRequestForm({
  order,
  claims,
  idempotencyKey,
  onClose,
  onDone,
  onFailed,
}: CancelRequestFormProps) {
  const tc = useTranslations("claims");
  const { busy, run } = useSubmitLock();
  const [error, setError] = useState<string | null>(null);
  // 사유는 미리 고르지 않는다 — 손님이 안 바꾸면 그 사유로 접수된다(UX 리뷰 F1)
  const [reasonCode, setReasonCode] = useState<ReasonCode | null>(null);
  const [detail, setDetail] = useState("");
  // 보내기 전에 환불 금액과 함께 한 번 더 묻는다(UX 리뷰 F2) — 돈이 바로 움직이는 요청이다
  const [confirming, setConfirming] = useState(false);
  const left = remainingQty(order, claims);
  const pick = useLineSelection(order, left);
  const quote = cancelQuote(order, claims, pick.lines);
  const tr = useTranslations("returns");
  const refundLabel = formatKRW(quote.refundAmount);
  const blocked = busy || pick.partialEmpty || reasonCode === null || quote.itemsAmount <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked || reasonCode === null) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    await run(async () => {
      setError(null);
      try {
        await api.createClaim(order.orderId, {
          idempotencyKey,
          reasonCode,
          reasonDetail: detail.trim() || undefined,
          lines: pick.lines,
        });
      } catch (err) {
        const errorKey = claimErrorKey(err);
        const errorMessage = tc(errorKey);
        setError(errorMessage);
        setConfirming(false);
        await onFailed();
        return;
      }
      await onDone();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-[20px] border-t border-line pt-[16px]"
    >
      {error && (
        <p role="alert" className="m-0 text-[14px] text-alert">
          {error}
        </p>
      )}

      <ReasonPicker
        legend={tc("formTitle")}
        reasons={REASON_CODES}
        value={reasonCode}
        onChange={(r) => {
          setReasonCode(r);
          setConfirming(false);
        }}
      />

      <DetailField
        id="cancel-detail"
        label={tc("detail")}
        placeholder={tc("detailPlaceholder")}
        value={detail}
        onChange={setDetail}
      />

      <LinesPicker
        order={order}
        left={left}
        scope={pick.scope}
        onScope={(s) => {
          pick.setScope(s);
          setConfirming(false);
        }}
        qty={pick.qty}
        onQty={(lineId, n) => {
          pick.setLineQty(lineId, n);
          setConfirming(false);
        }}
        labels={{
          legend: tc("scope"),
          full: tc("scopeFull"),
          partial: tc("scopePartial"),
          hint: tc("partialHint"),
        }}
        partialEmpty={pick.partialEmpty}
      />

      {/* 환불 예정 금액 — 반품 폼과 같은 칸(서버 규칙과 같은 계산, 금액의 권위는 서버) */}
      <section aria-label={tr("quoteTitle")} className="border border-line p-[16px]">
        <h3 className="m-0 mb-[8px] text-[14px] font-medium text-ink">{tr("quoteTitle")}</h3>
        <QuoteRow label={tr("quoteItems")} value={formatKRW(quote.itemsAmount)} />
        {quote.refundedShipping > 0 && (
          <QuoteRow
            label={tr("quoteShippingBack")}
            value={`+${formatKRW(quote.refundedShipping)}`}
          />
        )}
        <div className="mt-[8px] flex items-baseline justify-between border-t border-line pt-[8px]">
          <span className="text-[15px] font-medium">{tr("quoteTotal")}</span>
          <b className="num text-[18px] font-medium">{refundLabel}</b>
        </div>
      </section>

      {!confirming ? (
        <div className="flex flex-wrap items-center gap-[8px_20px]">
          <Button type="submit" variant="danger" size="sm" disabled={blocked}>
            {tc("submit")}
          </Button>
          <Button type="button" variant="text" size="sm" disabled={busy} onClick={onClose}>
            {tc("cancel")}
          </Button>
          {reasonCode === null && (
            <p className="m-0 w-full text-[13px] text-grey">{tc("pickReason")}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-[8px]">
          <p className="m-0 w-full text-[15px] leading-[1.6] text-ink">
            {tc("confirmCancel", { amount: refundLabel })}
          </p>
          <Button type="submit" variant="danger" size="sm" disabled={busy}>
            {busy ? "…" : tc("confirmYes")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            {tc("confirmNo")}
          </Button>
        </div>
      )}

      <p className="m-0 text-[13px] leading-[1.6] text-grey">{tc("cardNote")}</p>
    </form>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function QuoteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[28px] items-center justify-between gap-[12px]">
      <span className="text-[14px] text-grey">{label}</span>
      <span className="num shrink-0 text-[14px]">{value}</span>
    </div>
  );
}

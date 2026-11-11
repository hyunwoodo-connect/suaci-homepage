"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { remainingQty } from "@/lib/claims/rules";
import { formatKRW } from "@/lib/format";
import {
  REASON_CODES,
  type Claim,
  type Order,
  type ReasonCode,
  type RefundPreviewRequest,
} from "@/types";

import { claimErrorKey } from "./claimError";
import DetailField from "./DetailField";
import LinesPicker from "./LinesPicker";
import ReasonPicker from "./ReasonPicker";
import RefundQuote from "./RefundQuote";
import { useSubmitLock } from "./useSubmitLock";
import { useLineSelection } from "./useLineSelection";
import { useRefundPreview } from "./useRefundPreview";

/**
 * 사유를 고르기 전 미리 보기에 싣는 사유 — 취소 금액은 사유로 달라지지 않아(API 계약: 사유는 반품 금액만 바꾼다)
 * 폼을 열자마자 금액을 보인다. 사유를 고르면 그 사유로 다시 묻는다
 */
const REASON_BEFORE_PICK: ReasonCode = "기타";

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
 * 이미 취소·환불된 수량은 고를 수 없다(남은 수량까지). 환불 금액은 서버 미리 보기가 준 것만 보이고,
 * 그 금액을 받기 전에는 보낼 수 없다
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
  // 일부를 골랐는데 고른 줄이 없으면 묻지 않는다 — 빈 줄 목록은 서버가 '남은 수량 전부'로 읽는다
  const previewInput: RefundPreviewRequest | null = pick.partialEmpty
    ? null
    : { type: "cancel", reasonCode: reasonCode ?? REASON_BEFORE_PICK, lines: pick.lines };
  const preview = useRefundPreview(order.orderId, previewInput);
  // 확인 단계에 보일 금액 — 서버가 준 것만. 받기 전(묻는 중·실패)에는 보낼 수 없다
  const refundLabel =
    preview.state.status === "loaded" ? formatKRW(preview.state.preview.refundAmount) : null;
  const blocked = busy || reasonCode === null || refundLabel === null;

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
        // 막힌 사이 주문이 바뀌었을 수 있다(다른 환불이 끝남) — 금액을 다시 묻는다
        preview.retry();
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

      <RefundQuote state={preview.state} onRetry={preview.retry} />

      {!confirming || refundLabel === null ? (
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

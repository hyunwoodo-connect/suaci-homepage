"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { remainingQty } from "@/lib/claims/rules";
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
  const [reasonCode, setReasonCode] = useState<ReasonCode>("단순변심");
  const [detail, setDetail] = useState("");
  const left = remainingQty(order, claims);
  const pick = useLineSelection(order, left);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pick.partialEmpty) return;
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
        setError(tc(claimErrorKey(err)));
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
        onChange={setReasonCode}
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
        onScope={pick.setScope}
        qty={pick.qty}
        onQty={pick.setLineQty}
        labels={{
          legend: tc("scope"),
          full: tc("scopeFull"),
          partial: tc("scopePartial"),
          hint: tc("partialHint"),
        }}
        partialEmpty={pick.partialEmpty}
      />

      <div className="flex flex-wrap items-center gap-[8px_20px]">
        <Button type="submit" variant="danger" size="sm" disabled={busy || pick.partialEmpty}>
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

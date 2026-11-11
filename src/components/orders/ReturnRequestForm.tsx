"use client";

import { useCallback, useState } from "react";

import { useTranslations } from "next-intl";

import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { RETURN_REASONS, remainingQty, returnWindow } from "@/lib/claims/rules";
import type { Claim, Order, RefundPreviewRequest, ReturnReason } from "@/types";

import { claimErrorKey } from "./claimError";
import DetailField from "./DetailField";
import LinesPicker from "./LinesPicker";
import PhotoPicker from "./PhotoPicker";
import ReasonPicker from "./ReasonPicker";
import RefundQuote from "./RefundQuote";
import { useSubmitLock } from "./useSubmitLock";
import { useLineSelection } from "./useLineSelection";
import { useRefundPreview } from "./useRefundPreview";

interface ReturnRequestFormProps {
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
 * 받은 뒤 반품 신청(환불 정책 v2) — 사유(단순 변심은 7일·미개봉 확인), 범위, 예상 환불 금액(반품 배송비 차감)을 보고 신청한다.
 * 돈은 여기서 움직이지 않는다: 상품이 돌아와 확인되면 관리자가 환불한다. 예상 금액은 서버 미리 보기가 준 것만 보이고
 * (신청 때와 같은 계산), 그 금액을 받기 전에는 보낼 수 없다.
 */
export default function ReturnRequestForm({
  order,
  claims,
  idempotencyKey,
  onClose,
  onDone,
  onFailed,
}: ReturnRequestFormProps) {
  const t = useTranslations("returns");
  const tc = useTranslations("claims");

  const [now] = useState(Date.now);
  const { changeOfMindOpen } = returnWindow(order, now);
  // 사유는 미리 고르지 않는다 — 불량인데 단순 변심으로 접수되면 반품 배송비가 빠진다(UX 리뷰 F1)
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [detail, setDetail] = useState("");
  const [unopened, setUnopened] = useState(false);
  const { busy, run } = useSubmitLock();
  const [error, setError] = useState<string | null>(null);
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);
  const handlePhotos = useCallback((ids: string[]) => setPhotoIds(ids), []);
  const handlePhotosBusy = useCallback((isBusy: boolean) => setPhotosBusy(isBusy), []);

  const left = remainingQty(order, claims);
  const pick = useLineSelection(order, left);
  const needsUnopened = reason === "단순변심";
  // 사유를 고르기 전(사유가 금액을 바꾼다)이거나 일부인데 고른 줄이 없으면 묻지 않는다 — 빈 줄 목록은 서버가 '남은 수량 전부'로 읽는다
  const previewInput: RefundPreviewRequest | null =
    reason === null || pick.partialEmpty
      ? null
      : { type: "return", reasonCode: reason, lines: pick.lines };
  const preview = useRefundPreview(order.orderId, previewInput);
  // 금액을 받기 전(묻는 중·실패 — 반품 배송비를 빼면 남는 돈이 없다는 답 포함)에는 보내지 않는다
  const blocked =
    busy ||
    photosBusy ||
    reason === null ||
    (needsUnopened && !unopened) ||
    preview.state.status !== "loaded";
  // 버튼이 왜 잠겼는지 버튼 바로 옆에(UX 리뷰 F3) — 미개봉 체크는 사유 칩 아래라 폰에선 버튼과 멀다
  const blockedHint =
    reason === null ? tc("pickReason") : needsUnopened && !unopened ? t("needUnopened") : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked || reason === null) return;
    await run(async () => {
      setError(null);
      try {
        await api.createReturn(order.orderId, {
          idempotencyKey,
          reasonCode: reason,
          reasonDetail: detail.trim() || undefined,
          lines: pick.lines,
          unopenedConfirmed: needsUnopened && unopened,
          ...(photoIds.length > 0 && { photoIds }),
        });
      } catch (err) {
        const errorKey = claimErrorKey(err);
        const errorMessage = tc(errorKey);
        setError(errorMessage);
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
        legend={t("formTitle")}
        reasons={RETURN_REASONS}
        value={reason}
        onChange={setReason}
        isDisabled={(code) => code === "단순변심" && !changeOfMindOpen}
      >
        {!changeOfMindOpen && (
          <p className="m-0 mt-[10px] text-[13px] text-grey">{t("changeOfMindClosed")}</p>
        )}
      </ReasonPicker>

      {/* 단순 변심 — 미개봉·미사용 확인(환불 정책 v2) */}
      {needsUnopened && (
        <div>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-[10px] text-[15px] text-ink">
            <input
              type="checkbox"
              checked={unopened}
              onChange={(e) => setUnopened(e.target.checked)}
              className="size-[20px] accent-ink"
            />
            {t("unopened")}
          </label>
          <p className="m-0 text-[13px] leading-[1.6] text-grey">{t("unopenedNote")}</p>
        </div>
      )}

      <DetailField
        id="return-detail"
        label={t("detail")}
        placeholder={t("detailPlaceholder")}
        value={detail}
        onChange={setDetail}
      />

      <PhotoPicker
        orderId={order.orderId}
        onChange={handlePhotos}
        onBusyChange={handlePhotosBusy}
      />

      <LinesPicker
        order={order}
        left={left}
        scope={pick.scope}
        onScope={pick.setScope}
        qty={pick.qty}
        onQty={pick.setLineQty}
        labels={{
          legend: t("scope"),
          full: t("scopeFull"),
          partial: t("scopePartial"),
          hint: t("partialHint"),
        }}
        partialEmpty={pick.partialEmpty}
      />

      {/* 예상 환불 금액 — 반품 배송비를 뺀 내역을 환불 전에 보여 준다(환불 정책 v2). 사유를 골라야 금액이 정해진다 */}
      {reason !== null && (
        <RefundQuote
          state={preview.state}
          onRetry={preview.retry}
          isFreeShipping={order.totals.shippingFee === 0}
        />
      )}

      <div className="flex flex-wrap items-center gap-[8px_20px]">
        <Button type="submit" size="sm" disabled={blocked}>
          {busy ? "…" : t("submit")}
        </Button>
        <Button type="button" variant="text" size="sm" disabled={busy} onClick={onClose}>
          {t("cancel")}
        </Button>
        {blockedHint && <p className="m-0 w-full text-[13px] text-grey">{blockedHint}</p>}
      </div>

      <p className="m-0 text-[13px] leading-[1.6] text-grey">{t("after")}</p>
    </form>
  );
}

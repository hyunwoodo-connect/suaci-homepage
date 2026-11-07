"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { formatKRW } from "@/lib/format";
import { RETURN_REASONS, remainingQty, returnQuote, returnWindow } from "@/lib/claims/rules";
import type { Claim, Order, ReturnReason } from "@/types";

import { claimErrorKey } from "./claimError";
import DetailField from "./DetailField";
import LinesPicker from "./LinesPicker";
import ReasonPicker from "./ReasonPicker";
import { useSubmitLock } from "./useSubmitLock";
import { useLineSelection } from "./useLineSelection";

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
 * 돈은 여기서 움직이지 않는다: 상품이 돌아와 확인되면 관리자가 환불한다. 금액의 권위는 서버(같은 규칙으로 신청 때 정한다).
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
  const [reason, setReason] = useState<ReturnReason>(changeOfMindOpen ? "단순변심" : "상품하자");
  const [detail, setDetail] = useState("");
  const [unopened, setUnopened] = useState(false);
  const { busy, run } = useSubmitLock();
  const [error, setError] = useState<string | null>(null);

  const left = remainingQty(order, claims);
  const pick = useLineSelection(order, left);
  const needsUnopened = reason === "단순변심";
  const quote = returnQuote(order, claims, reason, pick.lines);
  // 고를 상품이 없거나(이미 다 돌려받음) 반품 배송비를 빼면 남는 돈이 없으면 보내지 않는다
  const blocked =
    busy ||
    pick.partialEmpty ||
    (needsUnopened && !unopened) ||
    quote.itemsAmount <= 0 ||
    quote.refundAmount <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    await run(async () => {
      setError(null);
      try {
        await api.createReturn(order.orderId, {
          idempotencyKey,
          reasonCode: reason,
          reasonDetail: detail.trim() || undefined,
          lines: pick.lines,
          unopenedConfirmed: needsUnopened && unopened,
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

      {/* 예상 환불 금액 — 반품 배송비를 뺀 내역을 환불 전에 보여 준다(환불 정책 v2) */}
      <section aria-label={t("quoteTitle")} className="border border-line p-[16px]">
        <h3 className="m-0 mb-[8px] text-[14px] font-medium text-ink">{t("quoteTitle")}</h3>
        <QuoteRow label={t("quoteItems")} value={formatKRW(quote.itemsAmount)} />
        {quote.returnShippingFee > 0 && (
          <QuoteRow
            label={t(order.totals.shippingFee === 0 ? "quoteReturnFeeFree" : "quoteReturnFee")}
            value={`−${formatKRW(quote.returnShippingFee)}`}
          />
        )}
        {quote.refundedShipping > 0 && (
          <QuoteRow
            label={t("quoteShippingBack")}
            value={`+${formatKRW(quote.refundedShipping)}`}
          />
        )}
        <div className="mt-[8px] flex items-baseline justify-between border-t border-line pt-[8px]">
          <span className="text-[15px] font-medium">{t("quoteTotal")}</span>
          <b className="num text-[18px] font-medium">
            {formatKRW(Math.max(0, quote.refundAmount))}
          </b>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-[8px_20px]">
        <Button type="submit" size="sm" disabled={blocked}>
          {busy ? "…" : t("submit")}
        </Button>
        <Button type="button" variant="text" size="sm" disabled={busy} onClick={onClose}>
          {t("cancel")}
        </Button>
      </div>

      <p className="m-0 text-[13px] leading-[1.6] text-grey">{t("after")}</p>
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

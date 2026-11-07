"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import { CHIP, CHIP_OFF, CHIP_ON } from "@/components/pay/chip";
import Button from "@/components/ui/Button";
import { api, ApiClientError } from "@/lib/api";
import { formatKRW } from "@/lib/format";
import { RETURN_REASONS, returnQuote, returnWindow, remainingQty } from "@/lib/claims/rules";
import type { Claim, Order, ReturnReason } from "@/types";

import QtyStepper from "./QtyStepper";
import { useClaimSubmit } from "./useClaimSubmit";

/** 반품 신청이 막힌 이유 중 손님에게 따로 알리는 코드 — 메시지 `returns.error.{code}`. 그 밖은 claims.error.default */
const RETURN_ERRORS: readonly string[] = [
  "RETURN_WINDOW_CLOSED",
  "RETURN_ALREADY_REQUESTED",
  "RETURN_NOT_ALLOWED",
  "RETURN_UNOPENED_REQUIRED",
  "NOTHING_TO_REFUND",
];

interface ReturnRequestFormProps {
  order: Order;
  claims: Claim[];
  onClose: () => void;
  onDone: () => Promise<void>;
}

/**
 * 받은 뒤 반품 신청(환불 정책 v2) — 사유(단순 변심은 7일·미개봉 확인), 범위, 예상 환불 금액(반품 배송비 차감)을 보고 신청한다.
 * 돈은 여기서 움직이지 않는다: 상품이 돌아와 확인되면 관리자가 환불한다. 금액의 권위는 서버(같은 규칙으로 신청 때 정한다).
 */
export default function ReturnRequestForm({
  order,
  claims,
  onClose,
  onDone,
}: ReturnRequestFormProps) {
  const t = useTranslations("returns");
  const tc = useTranslations("claims");

  const [now] = useState(Date.now);
  const { changeOfMindOpen } = returnWindow(order, now);
  const [reason, setReason] = useState<ReturnReason>(changeOfMindOpen ? "단순변심" : "상품하자");
  const [detail, setDetail] = useState("");
  const [unopened, setUnopened] = useState(false);
  const [scope, setScope] = useState<"full" | "partial">("full");
  const [qty, setQty] = useState<Record<string, number>>({});
  const { busy, run } = useClaimSubmit();
  const [error, setError] = useState<string | null>(null);

  const left = remainingQty(order, claims);
  const partialLines = order.items
    .map((it) => ({ lineId: it.lineId, quantity: qty[it.lineId] ?? 0 }))
    .filter((l) => l.quantity > 0);
  const partialInvalid = scope === "partial" && partialLines.length === 0;
  const needsUnopened = reason === "단순변심";
  const quote = returnQuote(order, claims, reason, scope === "partial" ? partialLines : undefined);
  // 고를 상품이 없거나(이미 다 돌려받음) 반품 배송비를 빼면 남는 돈이 없으면 보내지 않는다
  const blocked =
    busy ||
    partialInvalid ||
    (needsUnopened && !unopened) ||
    quote.itemsAmount <= 0 ||
    quote.refundAmount <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    await run(async (idempotencyKey) => {
      setError(null);
      try {
        await api.createReturn(order.orderId, {
          idempotencyKey,
          reasonCode: reason,
          reasonDetail: detail.trim() || undefined,
          lines: scope === "partial" ? partialLines : undefined,
          unopenedConfirmed: needsUnopened && unopened,
        });
        await onDone();
      } catch (err) {
        setError(
          err instanceof ApiClientError && RETURN_ERRORS.includes(err.code)
            ? t(`error.${err.code}`)
            : tc("error.default"),
        );
      }
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

      {/* 사유 */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-[12px] p-0 text-[16px] font-medium text-ink">{t("formTitle")}</legend>
        <div className="flex flex-wrap gap-[8px]">
          {RETURN_REASONS.map((code) => {
            const active = reason === code;
            const closed = code === "단순변심" && !changeOfMindOpen;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={active}
                disabled={closed}
                onClick={() => setReason(code)}
                className={`${CHIP} ${active ? CHIP_ON : CHIP_OFF} disabled:pointer-events-none disabled:opacity-40`}
              >
                {tc(`reasonCode.${code}`)}
              </button>
            );
          })}
        </div>
        {!changeOfMindOpen && (
          <p className="m-0 mt-[10px] text-[13px] text-grey">{t("changeOfMindClosed")}</p>
        )}
      </fieldset>

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

      {/* 상세 (선택) */}
      <div>
        <label htmlFor="return-detail" className="mb-[6px] block text-[13px] text-grey">
          {t("detail")}
        </label>
        <textarea
          id="return-detail"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={3}
          placeholder={t("detailPlaceholder")}
          className="w-full resize-y border border-line bg-paper px-[12px] py-[11px] text-[16px] text-ink outline-none transition-colors placeholder:text-grey/50 focus:border-ink"
        />
      </div>

      {/* 범위 */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-[10px] p-0 text-[13px] text-grey">{t("scope")}</legend>
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
                {t(s === "full" ? "scopeFull" : "scopePartial")}
              </button>
            );
          })}
        </div>
      </fieldset>

      {scope === "partial" && (
        <ul className="m-0 list-none border border-line p-0">
          {order.items.map((item) => (
            <li
              key={item.lineId}
              className="flex flex-wrap items-center gap-[12px] border-b border-line px-[14px] py-[12px] last:border-b-0"
            >
              <div className="min-w-[140px] flex-1">
                <b className="block text-[15px] font-medium">{item.productName}</b>
                <span className="text-[13px] text-grey">
                  {item.optionName} · {tc("ownedQty", { n: left[item.lineId] ?? 0 })}
                </span>
              </div>
              <QtyStepper
                value={qty[item.lineId] ?? 0}
                max={left[item.lineId] ?? 0}
                onChange={(n) => setQty((prev) => ({ ...prev, [item.lineId]: n }))}
              />
            </li>
          ))}
        </ul>
      )}
      {partialInvalid && <p className="m-0 text-[13px] text-grey">{t("partialHint")}</p>}

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

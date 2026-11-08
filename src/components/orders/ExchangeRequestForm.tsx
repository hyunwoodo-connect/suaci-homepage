"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import Button from "@/components/ui/Button";
import { BUSINESS } from "@/constants/site";
import { api } from "@/lib/api";
import { EXCHANGE_REASONS, remainingQty } from "@/lib/claims/rules";
import type { Claim, ExchangeReason, Order } from "@/types";

import { claimErrorKey } from "./claimError";
import DetailField from "./DetailField";
import LinesPicker from "./LinesPicker";
import ReasonPicker from "./ReasonPicker";
import { useSubmitLock } from "./useSubmitLock";
import { useLineSelection } from "./useLineSelection";

interface ExchangeRequestFormProps {
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
 * 받은 뒤 교환 신청(환불 정책 v2 '교환') — 같은 제품의 새 제품으로, 회사 탓(하자·오배송·정보와 다름)만 받는다.
 * 배송비는 회사 부담이라 금액 칸이 없다. 단순 변심은 반품 후 새 주문으로 안내한다(왕복 배송비가 같다, PM 11/7).
 * 돈·재고는 여기서 움직이지 않는다: 관리자가 회수를 확인하고 새 제품을 보낸다.
 */
export default function ExchangeRequestForm({
  order,
  claims,
  idempotencyKey,
  onClose,
  onDone,
  onFailed,
}: ExchangeRequestFormProps) {
  const t = useTranslations("exchanges");
  const tc = useTranslations("claims");
  const [reason, setReason] = useState<ExchangeReason>("상품하자");
  const [detail, setDetail] = useState("");
  const { busy, run } = useSubmitLock();
  const [error, setError] = useState<string | null>(null);
  const left = remainingQty(order, claims);
  const pick = useLineSelection(order, left);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pick.partialEmpty) return;
    await run(async () => {
      setError(null);
      try {
        await api.createExchange(order.orderId, {
          idempotencyKey,
          reasonCode: reason,
          reasonDetail: detail.trim() || undefined,
          lines: pick.lines,
        });
      } catch (err) {
        const errorKey = claimErrorKey(err);
        const errorMessage = tc(errorKey);
        setError(errorMessage);
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
        reasons={EXCHANGE_REASONS}
        value={reason}
        onChange={setReason}
      >
        <p className="m-0 mt-[10px] text-[13px] leading-[1.6] text-grey">
          {t.rich("changeOfMind", {
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
      </ReasonPicker>

      <DetailField
        id="exchange-detail"
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

      <p className="m-0 border border-line p-[16px] text-[14px] leading-[1.6] text-ink">
        {t("sameProduct")}
      </p>

      <div className="flex flex-wrap items-center gap-[8px_20px]">
        <Button type="submit" size="sm" disabled={busy || pick.partialEmpty}>
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

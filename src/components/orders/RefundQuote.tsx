"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { ApiClientError } from "@/lib/api";
import { formatKRW } from "@/lib/format";
import type { RefundPreview } from "@/types";

import type { RefundPreviewState } from "./useRefundPreview";

/** 줄 금액(14px 글자 '₩28,000') 자리의 뼈대 크기 */
const ROW_SKELETON = "h-[12px] w-[56px]";
/** 합계(18px 글자) 자리의 뼈대 크기 */
const TOTAL_SKELETON = "h-[14px] w-[76px]";

interface RefundQuoteProps {
  state: RefundPreviewState;
  onRetry: () => void;
  /** 무료 배송 주문 — 반품 배송비 줄 이름이 '처음 배송비 포함'으로 바뀐다 */
  isFreeShipping?: boolean;
}

/**
 * 취소·반품 폼의 예상 환불 금액 칸 — 금액은 서버 미리 보기(`useRefundPreview`)가 준 것만 보인다.
 * 묻는 동안에는 같은 줄에 뼈대를 두어 칸 크기가 그대로고, 못 받으면 금액 대신 한 줄(일시 실패면 '다시 시도')이다.
 */
export default function RefundQuote({ state, onRetry, isFreeShipping = false }: RefundQuoteProps) {
  const t = useTranslations("returns");
  const tc = useTranslations("claims");
  const tm = useTranslations("common");
  const isLoading = state.status === "loading";

  if (state.status === "failed") {
    const nothingLeft = nothingToRefund(state.error);
    let line: string;
    if (nothingLeft === "compensated") line = t("quoteCompensated");
    else if (nothingLeft === "fee") line = tc("error.NOTHING_TO_REFUND");
    else line = t("quoteFailed");
    return (
      <QuoteBox title={t("quoteTitle")}>
        <div className="flex flex-col items-start gap-[12px]">
          <p role="alert" className="m-0 text-[14px] leading-[1.6] text-ink">
            {line}
          </p>
          {/* 돌려드릴 금액이 없다는 답은 다시 물어도 같다 — 수량·사유를 바꾸면 새로 묻는다 */}
          {nothingLeft === null && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {tm("retry")}
            </Button>
          )}
        </div>
      </QuoteBox>
    );
  }

  // 묻는 동안의 줄은 바로 앞에 받은 금액을 따른다(숫자 자리는 뼈대) — 답이 와도 줄 수가 같으면 칸이 움직이지 않는다
  const rows = state.status === "loaded" ? state.preview : isLoading ? state.last : null;
  const returnFeeLabelKey = isFreeShipping ? "quoteReturnFeeFree" : "quoteReturnFee";

  return (
    <QuoteBox title={t("quoteTitle")} isBusy={isLoading}>
      <QuoteRow label={t("quoteItems")}>
        <QuoteAmount state={state} read={(p) => formatKRW(p.itemsAmount)} />
      </QuoteRow>
      {rows !== null && rows.returnShippingFee > 0 && (
        <QuoteRow label={t(returnFeeLabelKey)}>
          <QuoteAmount state={state} read={(p) => `−${formatKRW(p.returnShippingFee)}`} />
        </QuoteRow>
      )}
      {rows !== null && rows.refundedShipping > 0 && (
        <QuoteRow label={t("quoteShippingBack")}>
          <QuoteAmount state={state} read={(p) => `+${formatKRW(p.refundedShipping)}`} />
        </QuoteRow>
      )}
      {rows !== null && rows.priorCompensation > 0 && (
        <QuoteRow label={t("quotePriorCompensation")}>
          <QuoteAmount state={state} read={(p) => `−${formatKRW(p.priorCompensation)}`} />
        </QuoteRow>
      )}
      <div className="mt-[8px] flex items-baseline justify-between border-t border-line pt-[8px]">
        <span className="text-[15px] font-medium">{t("quoteTotal")}</span>
        {/* 금액이 바뀌면 화면 읽기가 새 금액을 읽는다 — 묻는 동안은 '불러오는 중…' */}
        <b
          role="status"
          aria-label={isLoading ? tm("loading") : undefined}
          className="num text-[18px] font-medium"
        >
          <QuoteAmount
            state={state}
            read={(p) => formatKRW(p.refundAmount)}
            skeleton={TOTAL_SKELETON}
          />
        </b>
      </div>
    </QuoteBox>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function QuoteBox({
  title,
  isBusy = false,
  children,
}: {
  title: string;
  isBusy?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} aria-busy={isBusy} className="border border-line p-[16px]">
      <h3 className="m-0 mb-[8px] text-[14px] font-medium text-ink">{title}</h3>
      {children}
    </section>
  );
}

function QuoteRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[28px] items-center justify-between gap-[12px]">
      <span className="text-[14px] text-grey">{label}</span>
      <span className="num shrink-0 text-[14px]">{children}</span>
    </div>
  );
}

/** 금액 자리 — 받았으면 그 금액, 묻는 중이면 같은 자리의 뼈대, 물을 것이 없으면 줄표 */
function QuoteAmount({
  state,
  read,
  skeleton = ROW_SKELETON,
}: {
  state: RefundPreviewState;
  read: (preview: RefundPreview) => string;
  skeleton?: string;
}) {
  if (state.status === "loaded") return read(state.preview);
  if (state.status === "loading") return <Skeleton inline className={skeleton} />;
  return <span className="text-grey">—</span>;
}

/* ─── 내부 ─────────────────────────── */

/**
 * 서버가 '돌려드릴 금액이 없다'(NOTHING_TO_REFUND)고 답한 까닭 — 그 답이 아니면(응답을 못 받음·다른 거절) null.
 * 같은 코드라도 409 는 먼저 드린 보상이 남은 금액을 다 채운 것, 400 은 반품 배송비를 빼면 남지 않는 것이다
 */
function nothingToRefund(error: unknown): "compensated" | "fee" | null {
  if (!(error instanceof ApiClientError) || error.code !== "NOTHING_TO_REFUND") return null;
  return error.status === 409 ? "compensated" : "fee";
}

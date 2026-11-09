import { useTranslations } from "next-intl";

import { CHECKOUT_PRICING, displayTotal } from "@/constants/checkout";
import { formatKRW } from "@/lib/format";

interface OrderTotalsProps {
  qty: number;
  className?: string;
}

/**
 * 결제 직전 합계 — 상품 × 수량, 배송비(무료면 '무료'), 결제 금액. 주문서와 재구매 시트가 같은 칸을 쓴다:
 * 바에서 본 상품가가 결제 버튼에서 배송비만큼 커지는 이유가 늘 보이게(UX 리뷰 D1)
 */
export default function OrderTotals({ qty, className = "" }: OrderTotalsProps) {
  const t = useTranslations("checkout");
  const tProduct = useTranslations("home.product");
  const itemsSubtotal = CHECKOUT_PRICING.price * qty;
  const total = displayTotal(qty);
  const isFree = total === itemsSubtotal;
  const itemsLabel = `${tProduct("name")} × ${String(qty)}`;
  const shippingValue = isFree ? t("freeShipping") : formatKRW(CHECKOUT_PRICING.shippingFee);

  return (
    <div className={`border border-line p-[16px] ${className}`}>
      <TotalRow label={itemsLabel} value={formatKRW(itemsSubtotal)} />
      <TotalRow label={t("shipping")} value={shippingValue} muted />
      <div className="mt-[12px] flex items-baseline justify-between border-t border-line pt-[12px]">
        <span className="text-[15px] font-medium">{t("grandTotal")}</span>
        <b className="num text-[20px] font-medium">{formatKRW(total)}</b>
      </div>
    </div>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function TotalRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-[12px] py-[4px]">
      <span className="text-[14px] text-grey">{label}</span>
      <span className={`num shrink-0 text-[14px] ${muted ? "text-grey" : "text-ink"}`}>
        {value}
      </span>
    </div>
  );
}

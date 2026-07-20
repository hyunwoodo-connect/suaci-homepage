"use client";

import { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/shell/PageShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import type { Order } from "@/types";

const krw = (n: number) => `₩${n.toLocaleString("ko-KR")}`;

/**
 * 주문 상세 — getOrder 계약 호출.
 */
export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const t = useTranslations("orders");
  const { status } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    void api.getOrder(orderId).then(setOrder).catch(() => setOrder(null));
  }, [status, orderId]);

  return (
    <PageShell no="OR" title={<>Order <em>detail</em></>} meta={order?.orderNo ?? ""}>
      {!order ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey">…</p>
      ) : (
        <div className="max-w-[860px]">
          {/* 상태 라인 */}
          <div className="flex gap-[8px] flex-wrap mb-[20px]">
            <Badge>{order.status}</Badge>
            <Badge>PAY · {order.paymentStatus}</Badge>
            <Badge>SHIP · {order.fulfillmentStatus}</Badge>
          </div>

          {/* 품목 */}
          <ul className="list-none m-0 p-0 border-[1.5px] border-ink mb-[20px]">
            {order.items.map((item) => (
              <li
                key={item.lineId}
                className="flex items-center gap-[16px] px-[16px] py-[13px] border-b-[1.5px] border-ink last:border-b-0"
              >
                <div className="flex-1">
                  <b className="font-display text-[15px] block">{item.productName}</b>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey">
                    {item.optionName} × {item.quantity}
                  </span>
                </div>
                <b className="font-display text-[15px] num">{krw(item.lineSubtotal)}</b>
              </li>
            ))}
          </ul>

          {/* 합계 + 배송지 */}
          <div className="grid grid-cols-2 gap-[20px] max-sm:grid-cols-1 mb-[28px]">
            <div className="border-[1.5px] border-ink p-[16px]">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey mt-0 mb-[12px]">
                {t("payment")}
              </h3>
              <TotalRow label={t("subtotal")} value={krw(order.totals.itemsSubtotal)} />
              <TotalRow label={t("shipping")} value={krw(order.totals.shippingFee)} />
              <TotalRow label={t("discount")} value={`−${krw(order.totals.discountTotal)}`} />
              <div className="flex justify-between items-baseline border-t-[1.5px] border-ink mt-[10px] pt-[10px]">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em]">{t("grandTotal")}</span>
                <b className="font-display text-[20px] num">{krw(order.totals.grandTotal)}</b>
              </div>
            </div>
            <div className="border-[1.5px] border-ink p-[16px]">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey mt-0 mb-[12px]">
                {t("shippingTo")}
              </h3>
              <p className="text-[13.5px] text-ink m-0 leading-[1.7]">
                <b>{order.shippingAddress.recipient}</b>
                <br />
                ({order.shippingAddress.zipcode}) {order.shippingAddress.addr1}{" "}
                {order.shippingAddress.addr2 ?? ""}
                <br />
                {order.shippingAddress.phone}
              </p>
            </div>
          </div>

          <Link href="/orders" className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey hover:text-ink">
            ← All orders
          </Link>
        </div>
      )}
    </PageShell>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.1em] bg-ink text-acid px-[8px] py-[3px]">
      {children}
    </span>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline py-[3px]">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey">{label}</span>
      <span className="font-mono text-[12px] num">{value}</span>
    </div>
  );
}

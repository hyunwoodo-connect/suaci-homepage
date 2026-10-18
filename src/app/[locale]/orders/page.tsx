"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/shell/PageShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import type { OrderSummary } from "@/types";

const krw = (n: number) => `₩${n.toLocaleString("ko-KR")}`;

/**
 * 주문 목록 — listOrders 계약 호출.
 */
export default function OrdersPage() {
  const t = useTranslations("orders");
  const { status } = useAuth();
  const [items, setItems] = useState<OrderSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    void api.listOrders().then((page) => {
      setItems(page.data);
      setLoaded(true);
    });
  }, [status]);

  if (status !== "authenticated") {
    return (
      <PageShell
        title={
          <>
            Your <em>orders</em>
          </>
        }
        meta=""
      >
        <Link
          href="/login"
          className="font-sans text-[12px] text-ink underline underline-offset-[3px]"
        >
          {t("needLogin")} →
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={
        <>
          Your <em>orders</em>
        </>
      }
      meta={t("meta")}
    >
      <div className="max-w-[860px]">
        {loaded && items.length === 0 && (
          <p className="font-sans text-[11px] text-grey">{t("empty")}</p>
        )}
        <ul className="list-none m-0 p-0 flex flex-col gap-[12px]">
          {items.map((o) => (
            <li key={o.orderId}>
              <Link
                href={`/orders/${o.orderId}`}
                className="flex items-center gap-[16px] border border-line px-[16px] py-[14px] hover:bg-paper transition-colors max-sm:flex-wrap"
              >
                <span className="font-sans text-[12px] text-ink">{o.orderNo}</span>
                <span className="font-sans text-[10px] text-grey">{o.createdDtm.slice(0, 10)}</span>
                <span className="font-sans text-[10px] bg-ink text-lime px-[7px] py-[2px]">
                  {o.status}
                </span>
                <b className="font-sans text-[15px] num ml-auto">{krw(o.grandTotal)}</b>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/account"
          className="inline-block mt-[32px] font-sans text-[11px] text-grey hover:text-ink"
        >
          ← Account
        </Link>
      </div>
    </PageShell>
  );
}

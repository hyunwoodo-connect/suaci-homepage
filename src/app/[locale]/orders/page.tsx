"use client";

import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import PageShell from "@/components/shell/PageShell";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDateKST, formatKRW } from "@/lib/format";
import type { OrderSummary } from "@/types";

/**
 * 주문 내역 — listOrders. 상태는 손님 말(orders.orderStatus.*)로. 없으면 제품으로 가는 길 하나.
 */
export default function OrdersPage() {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const ta = useTranslations("account");
  const { status, sessionEnded, refresh: recheckSession } = useAuth();
  const [items, setItems] = useState<OrderSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    void api
      .listOrders()
      .then((page) => {
        setItems(page.data);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.code === "AUTH_REQUIRED") {
          void recheckSession();
          return;
        }
        setLoadFailed(true);
      });
  }, [status, recheckSession]);

  if (status === "loading") {
    return (
      <PageShell title={t("title")}>
        <p className="m-0 text-[14px] text-grey">{tc("loading")}</p>
      </PageShell>
    );
  }

  if (status !== "authenticated") {
    return (
      <PageShell title={t("title")}>
        <div className="flex max-w-[400px] flex-col gap-[20px]">
          <p className="m-0 text-[15px] text-ink">
            {sessionEnded ? ta("sessionEnded") : t("needLogin")}
          </p>
          <Link
            href={{ pathname: "/login", query: { next: "/orders" } }}
            className="inline-flex h-[52px] items-center justify-center rounded-full bg-ink px-[24px] text-[15px] font-medium text-paper transition-colors hover:bg-ink-soft"
          >
            {ta("goLogin")}
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={t("title")}>
      <div className="flex max-w-[560px] flex-col gap-[24px]">
        {items === null && !loadFailed && (
          <p className="m-0 text-[14px] text-grey">{tc("loading")}</p>
        )}
        {loadFailed && (
          <p role="alert" className="m-0 text-[13px] text-alert">
            {t("loadError")}
          </p>
        )}

        {items !== null && items.length === 0 && (
          <div className="flex flex-col gap-[20px]">
            <p className="m-0 text-[15px] text-ink">{t("empty")}</p>
            <Link
              href={{ pathname: "/", hash: "product" }}
              className="inline-flex h-[52px] items-center justify-center rounded-full bg-ink px-[24px] text-[15px] font-medium text-paper transition-colors hover:bg-ink-soft"
            >
              {t("emptyCta")}
            </Link>
          </div>
        )}

        {items !== null && items.length > 0 && (
          <ul className="m-0 list-none border-t border-line p-0">
            {items.map((o) => (
              <li key={o.orderId} className="border-b border-line">
                <Link
                  href={`/orders/${o.orderId}`}
                  className="flex min-h-[68px] items-center gap-[16px] py-[12px]"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                    <span className="num text-[15px] text-ink">{o.orderNo}</span>
                    <span className="text-[13px] text-grey">
                      <span className="num">{formatDateKST(o.createdAt)}</span> ·{" "}
                      {t(`orderStatus.${o.status}`)}
                    </span>
                  </span>
                  <b className="num shrink-0 text-[15px] font-medium">{formatKRW(o.grandTotal)}</b>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link href="/account" className="self-start text-[13px] text-grey hover:text-ink">
          ← {ta("title")}
        </Link>
      </div>
    </PageShell>
  );
}

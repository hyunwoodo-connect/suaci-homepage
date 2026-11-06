"use client";

import { useCallback, useEffect, useState } from "react";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import PageShell from "@/components/shell/PageShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import Chevron from "@/components/ui/Chevron";
import Skeleton from "@/components/ui/Skeleton";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDateKST, formatKRW } from "@/lib/format";
import type { OrderSummary } from "@/types";

import { ORDER_STATE_TONE, orderState } from "./orderState";

/** 주문 한 줄의 틀 — 실제 줄과 뼈대 줄이 같은 높이가 되도록 한 곳에서 */
const ROW = "flex min-h-[76px] items-center gap-[16px] py-[14px]";

/**
 * 주문 내역 — listOrders. 로그인 토큰이 브라우저에만 있어 서버에서 미리 못 받는다:
 * 받는 동안은 같은 크기의 빈 줄(뼈대)을 두고, 다 받으면 한 번에 그린다. '주문 내역이 없어요'는 받은 뒤에만.
 */
export default function OrdersPage() {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const ta = useTranslations("account");
  const { status, sessionEnded, recheckSession } = useAuth();
  const [items, setItems] = useState<OrderSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(
    () =>
      api
        .listOrders()
        .then((page) => setItems(page.data))
        .catch((err: unknown) => {
          if (err instanceof ApiClientError && err.code === "AUTH_REQUIRED") {
            void recheckSession();
            return;
          }
          setLoadFailed(true);
        }),
    [recheckSession],
  );

  useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  if (status === "anonymous") {
    return (
      <PageShell title={t("title")}>
        <div className="flex max-w-[400px] flex-col gap-[20px]">
          <p className="m-0 text-[15px] text-ink">
            {sessionEnded ? ta("sessionEnded") : t("needLogin")}
          </p>
          <ButtonLink href={{ pathname: "/login", query: { next: "/orders" } }}>
            {t("goLogin")}
          </ButtonLink>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={t("title")}>
      <div className="flex max-w-[560px] flex-col gap-[24px]">
        {loadFailed ? (
          <div className="flex flex-col items-start gap-[16px]">
            <p role="alert" className="m-0 text-[15px] text-ink">
              {t("loadError")}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setLoadFailed(false);
                void load();
              }}
            >
              {tc("retry")}
            </Button>
          </div>
        ) : items === null ? (
          <OrdersSkeleton label={tc("loading")} />
        ) : items.length === 0 ? (
          <div className="flex flex-col gap-[20px]">
            <p className="m-0 text-[15px] text-ink">{t("empty")}</p>
            <ButtonLink href={{ pathname: "/", hash: "product" }}>{t("emptyCta")}</ButtonLink>
          </div>
        ) : (
          <ul className="m-0 list-none border-t border-line p-0">
            {items.map((o) => {
              const state = orderState(o);
              return (
                <li key={o.orderId} className="border-b border-line">
                  <Link href={`/orders/${o.orderId}`} className={ROW}>
                    <span className="flex min-w-0 flex-1 flex-col gap-[6px]">
                      <span className="flex items-center gap-[10px]">
                        <Badge tone={ORDER_STATE_TONE[state]}>{t(`state.${state}`)}</Badge>
                        <span className="num text-[13px] leading-[22px] text-grey">
                          {formatDateKST(o.createdAt)}
                        </span>
                      </span>
                      <span className="num truncate text-[15px] leading-[22px] text-ink">
                        {o.orderNo}
                      </span>
                    </span>
                    <b className="num shrink-0 text-[15px] font-medium">
                      {formatKRW(o.grandTotal)}
                    </b>
                    <Chevron />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <ButtonLink href="/account" variant="text" size="sm" className="self-start">
          ← {ta("title")}
        </ButtonLink>
      </div>
    </PageShell>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

/** 주문 줄 세 개 크기의 뼈대 — 뱃지·날짜 / 주문번호 / 금액 자리가 실제 줄과 같은 위치 */
function OrdersSkeleton({ label }: { label: string }) {
  return (
    <ul
      role="status"
      aria-label={label}
      aria-busy="true"
      className="m-0 list-none border-t border-line p-0"
    >
      {["w-[148px]", "w-[132px]", "w-[156px]"].map((w) => (
        <li key={w} className="border-b border-line">
          <div className={ROW}>
            <span className="flex min-w-0 flex-1 flex-col gap-[6px]">
              <span className="flex h-[22px] items-center gap-[10px]">
                <Skeleton shape="badge" className="h-[22px] w-[64px]" />
                <Skeleton className="h-[12px] w-[72px]" />
              </span>
              <span className="flex h-[22px] items-center">
                <Skeleton className={`h-[14px] ${w}`} />
              </span>
            </span>
            <Skeleton className="h-[14px] w-[64px]" />
            <span className="size-[16px] shrink-0" />
          </div>
        </li>
      ))}
    </ul>
  );
}

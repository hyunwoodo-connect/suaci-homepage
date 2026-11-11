"use client";

import { useCallback, useEffect, useState } from "react";

import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import LoginRequired from "@/components/shell/LoginRequired";
import PageShell from "@/components/shell/PageShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import Chevron from "@/components/ui/Chevron";
import Skeleton from "@/components/ui/Skeleton";
import { api, isAuthRequired } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDateKST, formatKRW, itemName } from "@/lib/format";
import type { OrderSummary } from "@/types";

import { ORDER_STATE_TONE } from "./orderState";

/** 주문 한 줄의 틀 — 실제 줄과 뼈대 줄이 같은 높이가 되도록 한 곳에서 */
const ROW = "flex min-h-[76px] items-center gap-[16px] py-[14px]";

/**
 * 주문 내역 — listOrders. 로그인 토큰이 브라우저에만 있어 서버에서 미리 못 받는다:
 * 받는 동안은 같은 크기의 빈 줄(뼈대)을 두고, 다 받으면 한 번에 그린다. '주문 내역이 없어요'는 받은 뒤에만.
 */
export default function OrdersPage() {
  const t = useTranslations("orders");
  const locale = useLocale();
  const tc = useTranslations("common");
  const ta = useTranslations("account");
  const { status, recheckSession } = useAuth();
  const [items, setItems] = useState<OrderSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(
    () =>
      api
        .listOrders()
        .then((page) => setItems(page.data))
        .catch((err: unknown) => {
          if (isAuthRequired(err)) {
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
      <LoginRequired
        title={t("title")}
        needLogin={t("needLogin")}
        cta={t("goLogin")}
        next="/orders"
      />
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
              const itemsLine = summaryLine(o, locale, t);
              return (
                <li key={o.orderId} className="border-b border-line">
                  <Link href={`/orders/${o.orderId}`} className={ROW}>
                    <span className="flex min-w-0 flex-1 flex-col gap-[6px]">
                      <span className="flex items-center gap-[10px]">
                        <Badge tone={ORDER_STATE_TONE[o.state]}>{t(`state.${o.state}`)}</Badge>
                        <span className="num text-[13px] leading-[22px] text-grey">
                          {formatDateKST(o.createdAt)}
                        </span>
                      </span>
                      {/* 무엇을 몇 개 — 같은 날 주문도 구별된다(UX 리뷰 E4). 옛 주문은 요약이 없어 번호만 */}
                      {itemsLine && (
                        <span className="num truncate text-[15px] leading-[22px] text-ink">
                          {itemsLine}
                        </span>
                      )}
                      <span
                        className={`num truncate leading-[22px] ${itemsLine ? "text-[13px] text-grey" : "text-[15px] text-ink"}`}
                      >
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

/* ─── 내부 ─────────────────────────── */

/** 목록 한 줄의 품목 — '이름 × 수량', 여러 줄이면 '이름 외 N건 · 수량'. 요약이 없는 옛 주문은 null */
function summaryLine(
  o: OrderSummary,
  locale: string,
  t: (key: "itemLine" | "itemLineMore", values: Record<string, string | number>) => string,
): string | null {
  const s = o.itemSummary;
  if (!s) return null;
  const name = itemName(s, locale);
  const more = s.lineCount - 1;
  if (more > 0) return t("itemLineMore", { name, more, qty: s.quantity });
  return t("itemLine", { name, qty: s.quantity });
}

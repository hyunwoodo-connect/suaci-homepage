"use client";

import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import PageShell from "@/components/shell/PageShell";
import Button from "@/components/ui/Button";
import ButtonLink from "@/components/ui/ButtonLink";
import Chevron from "@/components/ui/Chevron";
import Skeleton from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDateKST } from "@/lib/format";

/** 메뉴 한 줄의 틀 — 실제 줄과 뼈대 줄이 같은 높이 */
const MENU_ROW = "flex min-h-[68px] items-center gap-[16px] py-[12px]";

/**
 * 내 계정 — 이름·이메일(있을 때만)·가입일, 배송지·주문 내역 줄, 로그아웃.
 * 배송지 줄의 한 줄 요약(기본 배송지)까지 받은 뒤 한 번에 그린다 — 그동안은 같은 틀의 뼈대.
 */
export default function AccountPage() {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const router = useRouter();
  const { user, status, sessionEnded, logout } = useAuth();
  // undefined = 아직 받는 중, null = 못 받음(줄 이름만 보인다)
  const [addressSummary, setAddressSummary] = useState<string | null | undefined>(undefined);
  const noneLabel = t("addressesNone");

  useEffect(() => {
    if (status !== "authenticated") return;
    void api
      .listAddresses()
      .then((list) => {
        const main = list.find((a) => a.isDefault) ?? list[0];
        setAddressSummary(main ? main.addr1 : noneLabel);
      })
      .catch(() => setAddressSummary(null));
  }, [status, noneLabel]);

  if (status === "anonymous" || (status === "authenticated" && !user)) {
    return (
      <PageShell title={t("title")}>
        <div className="flex max-w-[400px] flex-col gap-[20px]">
          <p className="m-0 text-[15px] text-ink">
            {sessionEnded ? t("sessionEnded") : t("needLogin")}
          </p>
          <ButtonLink href={{ pathname: "/login", query: { next: "/account" } }}>
            {t("goLogin")}
          </ButtonLink>
        </div>
      </PageShell>
    );
  }

  if (!user || addressSummary === undefined) {
    return (
      <PageShell title={t("title")} meta={<Skeleton inline className="h-[12px] w-[96px]" />}>
        <AccountSkeleton label={tc("loading")} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={t("title")}
      meta={user.name ? t("hello", { name: user.name }) : t("helloNoName")}
    >
      <div className="flex max-w-[560px] flex-col">
        <dl className="m-0 flex flex-col gap-[12px]">
          <InfoRow label={t("name")} value={user.name} />
          {/* 카카오가 이메일을 안 주면 비어 있다 — 빈 줄을 그리지 않는다 */}
          {user.email && <InfoRow label={t("email")} value={user.email} />}
          <InfoRow label={t("memberSince")} value={formatDateKST(user.createdAt)} />
        </dl>

        <ul className="m-0 mt-[40px] list-none border-t border-line p-0">
          <li className="border-b border-line">
            <MenuLink href="/account/addresses" label={t("addresses")} sub={addressSummary} />
          </li>
          <li className="border-b border-line">
            <MenuLink href="/orders" label={t("orders")} />
          </li>
        </ul>

        <Button
          variant="secondary"
          className="mt-[40px] self-start"
          onClick={async () => {
            await logout();
            router.push("/");
          }}
        >
          {t("logout")}
        </Button>
      </div>
    </PageShell>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-[16px]">
      <dt className="w-[72px] shrink-0 text-[13px] leading-[24px] text-grey">{label}</dt>
      <dd className="m-0 min-w-0 break-all text-[15px] leading-[24px] text-ink">{value}</dd>
    </div>
  );
}

function MenuLink({ href, label, sub }: { href: string; label: string; sub?: string | null }) {
  return (
    <Link href={href} className={MENU_ROW}>
      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="text-[16px] leading-[24px] text-ink">{label}</span>
        {sub && <span className="truncate text-[13px] leading-[20px] text-grey">{sub}</span>}
      </span>
      <Chevron />
    </Link>
  );
}

/** 계정 뼈대 — 정보 세 줄 / 메뉴 두 줄 / 로그아웃 알약이 실제와 같은 자리 */
function AccountSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="flex max-w-[560px] flex-col">
      <div className="flex flex-col gap-[12px]">
        {["w-[56px]", "w-[168px]", "w-[80px]"].map((w) => (
          <div key={w} className="flex h-[24px] items-center gap-[16px]">
            <span className="w-[72px] shrink-0">
              <Skeleton className="h-[12px] w-[40px]" />
            </span>
            <Skeleton className={`h-[14px] ${w}`} />
          </div>
        ))}
      </div>

      <ul className="m-0 mt-[40px] list-none border-t border-line p-0">
        {[true, false].map((hasSub) => (
          <li key={String(hasSub)} className="border-b border-line">
            <div className={MENU_ROW}>
              <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <span className="flex h-[24px] items-center">
                  <Skeleton className="h-[14px] w-[64px]" />
                </span>
                {hasSub && (
                  <span className="flex h-[20px] items-center">
                    <Skeleton className="h-[12px] w-[200px] max-w-full" />
                  </span>
                )}
              </span>
              <span className="size-[16px] shrink-0" />
            </div>
          </li>
        ))}
      </ul>

      <Skeleton shape="pill" className="mt-[40px] h-[52px] w-[112px]" />
    </div>
  );
}

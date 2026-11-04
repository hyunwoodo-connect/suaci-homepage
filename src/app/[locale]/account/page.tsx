"use client";

import { useEffect, useState } from "react";

import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import PageShell from "@/components/shell/PageShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDateKST } from "@/lib/format";
import type { Address } from "@/types";
import ButtonLink from "@/components/ui/ButtonLink";

/**
 * 내 계정 — 이름·이메일(있을 때만)·가입일, 배송지·주문 내역 줄, 로그아웃.
 */
export default function AccountPage() {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const router = useRouter();
  const { user, status, sessionEnded, logout } = useAuth();

  if (status === "loading") {
    return (
      <PageShell title={t("title")}>
        <p className="m-0 text-[14px] text-grey">{tc("loading")}</p>
      </PageShell>
    );
  }

  if (status !== "authenticated" || !user) {
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
            <AddressesRow label={t("addresses")} none={t("addressesNone")} />
          </li>
          <li className="border-b border-line">
            <MenuLink href="/orders" label={t("orders")} />
          </li>
        </ul>

        <Button
          variant="outline"
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
      <dt className="w-[72px] shrink-0 text-[13px] text-grey">{label}</dt>
      <dd className="m-0 min-w-0 break-all text-[15px] text-ink">{value}</dd>
    </div>
  );
}

/** 배송지 줄 — 기본 배송지 한 줄(없으면 '아직 없어요')을 같이 보여 준다. 못 불러오면 이름만 */
function AddressesRow({ label, none }: { label: string; none: string }) {
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    void api
      .listAddresses()
      .then((list: Address[]) => {
        const main = list.find((a) => a.isDefault) ?? list[0];
        setSummary(main ? main.addr1 : none);
      })
      .catch(() => {});
  }, [none]);

  return <MenuLink href="/account/addresses" label={label} sub={summary} />;
}

function MenuLink({ href, label, sub }: { href: string; label: string; sub?: string | null }) {
  return (
    <Link href={href} className="flex min-h-[68px] items-center gap-[16px] py-[12px]">
      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="text-[16px] text-ink">{label}</span>
        {sub && <span className="truncate text-[13px] text-grey">{sub}</span>}
      </span>
      <Chevron />
    </Link>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-grey"
      />
    </svg>
  );
}

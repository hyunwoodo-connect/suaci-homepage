"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import PageShell from "@/components/shell/PageShell";
import { useAuth } from "@/lib/auth/auth-context";

/**
 * 계정 — getMe 결과 표시 + 하위 메뉴(배송지/주문/장바구니) + 로그아웃.
 */
export default function AccountPage() {
  const t = useTranslations("account");
  const router = useRouter();
  const { user, status, logout } = useAuth();

  if (status === "loading") {
    return (
      <PageShell title={<>My <em>account</em></>} meta="">
        <p className="font-sans text-[11px] text-grey">…</p>
      </PageShell>
    );
  }

  if (status !== "authenticated" || !user) {
    return (
      <PageShell title={<>My <em>account</em></>} meta={t("needLogin")}>
        <div className="max-w-[440px] flex flex-col gap-[18px]">
          <p className="text-[15px] text-ink m-0">{t("needLogin")}</p>
          <Link href="/login">
            <Button>{t("goLogin")}</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={<>My <em>account</em></>} meta={user.email}>
      <div className="max-w-[720px]">
        <div className="border border-line mb-[28px]">
          <SpecRow label={t("name")} value={user.name} />
          <SpecRow label={t("email")} value={user.email} />
          <SpecRow label={t("memberSince")} value={user.createdDtm.slice(0, 10)} />
          <SpecRow label={t("status")} value={user.status.toUpperCase()} last />
        </div>

        {/* 메뉴 */}
        <div className="grid grid-cols-2 gap-[12px] max-sm:grid-cols-1 mb-[28px]">
          <MenuCard href="/account/addresses" label="addresses" />
          <MenuCard href="/orders" label="orders" />
        </div>

        <Button
          variant="outline"
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

function SpecRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-baseline gap-[16px] px-[16px] py-[13px] ${last ? "" : "border-b border-line"}`}>
      <span className="font-sans text-[10px] text-grey w-[120px] shrink-0">
        {label}
      </span>
      <b className="font-sans text-[15px]">{value}</b>
    </div>
  );
}

function MenuCard({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="border border-line px-[16px] py-[18px] font-sans text-[12px] text-ink hover:bg-ink hover:text-lime transition-colors"
    >
      {label} →
    </Link>
  );
}

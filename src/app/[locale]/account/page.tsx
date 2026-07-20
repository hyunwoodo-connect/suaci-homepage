"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import PageShell from "@/components/shell/PageShell";
import { useAuth } from "@/lib/auth/auth-context";
import { useCart } from "@/lib/cart/cart-context";

/**
 * 계정 — getMe 결과 표시 + 하위 메뉴(배송지/주문/장바구니) + 로그아웃.
 */
export default function AccountPage() {
  const t = useTranslations("account");
  const router = useRouter();
  const { user, status, logout } = useAuth();
  const { itemCount } = useCart();

  if (status === "loading") {
    return (
      <PageShell no="AC" title={<>My <em>account</em></>} meta="">
        <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-grey">…</p>
      </PageShell>
    );
  }

  if (status !== "authenticated" || !user) {
    return (
      <PageShell no="AC" title={<>My <em>account</em></>} meta={t("needLogin")}>
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
    <PageShell no="AC" title={<>My <em>account</em></>} meta={user.email}>
      <div className="max-w-[720px]">
        {/* 프로필 스펙 행 — pr-spec 문법 재사용 */}
        <div className="border-[1.5px] border-ink mb-[28px]">
          <SpecRow label={t("name")} value={user.name} />
          <SpecRow label={t("email")} value={user.email} />
          <SpecRow label={t("memberSince")} value={user.createdDtm.slice(0, 10)} />
          <SpecRow label={t("status")} value={user.status.toUpperCase()} last />
        </div>

        {/* 메뉴 */}
        <div className="grid grid-cols-3 gap-[12px] max-sm:grid-cols-1 mb-[28px]">
          <MenuCard href="/account/addresses" label={t("menuAddresses")} />
          <MenuCard href="/orders" label={t("menuOrders")} />
          <MenuCard href="/cart" label={`${t("menuCart")} (${itemCount})`} />
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
    <div className={`flex items-baseline gap-[16px] px-[16px] py-[13px] ${last ? "" : "border-b-[1.5px] border-ink"}`}>
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-grey w-[120px] shrink-0">
        {label}
      </span>
      <b className="font-display text-[15px]">{value}</b>
    </div>
  );
}

function MenuCard({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="border-[1.5px] border-ink px-[16px] py-[18px] font-mono text-[12px] uppercase tracking-[0.08em] text-ink hover:bg-ink hover:text-acid transition-colors"
    >
      {label} →
    </Link>
  );
}

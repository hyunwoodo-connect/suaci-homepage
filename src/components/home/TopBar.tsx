"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useAuth } from "@/lib/auth/auth-context";

const LOCALES: Locale[] = ["ko", "en", "ja", "zh", "th"];

/**
 * v4 상단 바 — 로고 / 앵커 nav + 계정 / 언어 / CTA.
 * 홈과 서브페이지(PageShell) 공용. 12컬럼 그리드의 직계 자식.
 */
export default function TopBar() {
  const t = useTranslations("v4.nav");
  const { status } = useAuth();

  return (
    <div className="bar">
      <Link className="bar__logo" href="/">
        suaci
      </Link>
      <nav className="bar__nav">
        <Link href="/#product">{t("product")}</Link>
        <Link href="/#moments">{t("moments")}</Link>
        <Link href="/#story">{t("story")}</Link>
        <Link href="/#order">{t("waitlist")}</Link>
        <Link href={status === "authenticated" ? "/account" : "/login"}>
          {status === "authenticated" ? t("account") : t("login")}
        </Link>
      </nav>
      <LangSwitcher />
      <Link className="bar__cta" href="/#order">
        {t("cta")} →
      </Link>
    </div>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function LangSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="bar__lang" aria-label="language">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => {
            if (code !== locale) router.replace(pathname, { locale: code });
          }}
          className={code === locale ? "is-active" : ""}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

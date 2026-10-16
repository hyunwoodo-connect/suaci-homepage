"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { HOME_MEDIA } from "@/constants/product";
import { useAuth } from "@/lib/auth/auth-context";

interface SiteHeaderProps {
  /** true면 히어로 위에 투명하게 겹친다(홈). false면 흰 바탕 위 일반 흐름(서브페이지). */
  overlay?: boolean;
}

/**
 * v5 헤더 — 로고 / en·jp / 계정 아이콘.
 * 구매 CTA는 두지 않는다(원클릭 바 하나만 남긴다).
 */
export default function SiteHeader({ overlay = false }: SiteHeaderProps) {
  const t = useTranslations("home.header");
  const locale = useLocale();
  const pathname = usePathname();
  const { status } = useAuth();
  const accountHref = status === "authenticated" ? "/account" : "/login";

  return (
    <header
      className={`${overlay ? "absolute inset-x-0 top-0" : "relative"} z-10 flex items-center justify-between px-[16px] py-[18px] md:px-[48px] md:py-[24px]`}
    >
      <Link href="/" aria-label="suaci" className="block">
        <Image
          src={HOME_MEDIA.logoBlack}
          alt="suaci"
          width={1608}
          height={400}
          priority
          unoptimized
          className="h-[20px] w-auto md:h-[22px]"
        />
      </Link>

      <div className="flex items-center gap-[20px] text-[13px]">
        <nav aria-label={t("lang")} className="flex items-center gap-[6px]">
          <Link
            href={pathname}
            locale="en"
            aria-current={locale === "en" ? "true" : undefined}
            className={locale === "en" ? "text-ink" : "text-grey hover:text-ink"}
          >
            en
          </Link>
          <span aria-hidden="true" className="text-grey">/</span>
          <Link
            href={pathname}
            locale="ja"
            aria-current={locale === "ja" ? "true" : undefined}
            className={locale === "ja" ? "text-ink" : "text-grey hover:text-ink"}
          >
            jp
          </Link>
        </nav>
        <Link
          href={accountHref}
          aria-label={status === "authenticated" ? t("account") : t("signIn")}
          className="flex h-[32px] w-[32px] items-center justify-center rounded-full text-ink hover:bg-ink/5"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8.5" r="3.75" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4.75 19.5c1.2-3.3 4-5 7.25-5s6.05 1.7 7.25 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </Link>
      </div>
    </header>
  );
}

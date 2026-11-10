"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { HOME_MEDIA } from "@/constants/product";
import { IS_EVENTS_MENU_VISIBLE } from "@/constants/site";
import { useAuth } from "@/lib/auth/auth-context";

import LanguageMenu from "./LanguageMenu";

interface SiteHeaderProps {
  /** true면 히어로 위에 투명하게 겹친다(홈). false면 흰 바탕 위 일반 흐름(서브페이지). */
  overlay?: boolean;
  /** true면 로고만 — 결제 결과처럼 주소 쿼리가 중요한 화면(언어 링크는 경로만 들고 가 쿼리를 잃는다) */
  minimal?: boolean;
}

/**
 * v5 헤더 — 로고 / 이벤트(`IS_EVENTS_MENU_VISIBLE` 일 때만) · 언어(지구본 + 지금 언어, 눌러서 고름) · 계정 아이콘.
 * 폰도 같은 헤더(따로 접는 메뉴 없음).
 * 구매 CTA는 두지 않는다(원클릭 바 하나만 남긴다).
 */
export default function SiteHeader({ overlay = false, minimal = false }: SiteHeaderProps) {
  const t = useTranslations("home.header");
  const pathname = usePathname();
  const { status } = useAuth();
  const isEventsActive = pathname === "/events" || pathname.startsWith("/events/");
  const accountHref = status === "authenticated" ? "/account" : "/login";

  return (
    // z-30: 사기 바(z-20)보다 위 — 가로로 눕힌 폰처럼 낮은 화면에서 펼친 언어 목록을 바가 덮지 않게. 시트(z-50)보단 아래
    <header
      className={`${overlay ? "absolute inset-x-0 top-0" : "relative"} z-30 px-[16px] py-[6px] md:px-[48px] md:py-[13px]`}
    >
      {/* 본문(.sec·홈 섹션)과 같은 최대 폭 — 넓은 화면에서 로고가 본문 왼쪽 선에 맞는다 */}
      <div className="mx-auto flex max-w-[1344px] items-center justify-between">
        {/* 누르는 자리는 모두 44px — 보이는 크기는 그대로 두고 칸만 넓힌다 */}
        <Link href="/" aria-label="suaci" className="flex h-[44px] items-center">
          <Image
            src={HOME_MEDIA.logoBlack}
            alt="suaci"
            width={1608}
            height={400}
            priority
            unoptimized
            className="h-[18px] w-auto min-[360px]:h-[20px] md:h-[22px]"
          />
        </Link>

        {!minimal && (
          <div className="flex items-center gap-[2px] text-[13px] min-[360px]:gap-[4px] md:gap-[12px]">
            {IS_EVENTS_MENU_VISIBLE && (
              <Link
                href="/events"
                aria-current={isEventsActive ? "page" : undefined}
                className={`flex h-[44px] items-center whitespace-nowrap px-[4px] min-[360px]:px-[6px] ${isEventsActive ? "text-ink" : "text-grey hover:text-ink"}`}
              >
                {t("events")}
              </Link>
            )}
            <LanguageMenu />
            <Link
              href={accountHref}
              aria-label={status === "authenticated" ? t("account") : t("signIn")}
              className="relative flex h-[44px] w-[44px] items-center justify-center rounded-full text-ink hover:bg-ink/5"
            >
              {/* 로그인해 있으면 라임 점 하나 — 들어와 있다는 표시 */}
              {status === "authenticated" && (
                <span
                  aria-hidden="true"
                  className="absolute right-[10px] top-[10px] size-[7px] rounded-full bg-lime ring-2 ring-paper"
                />
              )}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8.5" r="3.75" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M4.75 19.5c1.2-3.3 4-5 7.25-5s6.05 1.7 7.25 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

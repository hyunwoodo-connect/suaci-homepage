import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import ConsentSettingsButton from "@/components/analytics/ConsentSettingsButton";
import { hasAnalytics } from "@/lib/analytics";
import { HOME_MEDIA } from "@/constants/product";
import { BUSINESS, SITE } from "@/constants/site";

// 누르는 자리는 44px — 줄 사이 여백 대신 칸 높이로 띄운다
const LINK = "flex min-h-[44px] items-center transition-colors hover:text-grey";
const SMALL_LINK =
  "inline-flex min-h-[44px] min-w-[44px] items-center transition-colors hover:text-ink";

/**
 * v5 푸터 — 흰 바탕. 위: 슬로건(라임 점 하나)·제품 한 줄 / 오른쪽 링크 두 묶음,
 * 가는 선 아래: 사업자 정보(전자상거래법 표시사항)·정책, 맨 아래 잘려 나가는 대형 로고.
 * 정책 링크는 /legal/* 로.
 */
export default function SiteFooter() {
  const t = useTranslations("home.footer");
  const tConsent = useTranslations("consent");
  const tp = useTranslations("home.hero");

  return (
    <footer className="w-full overflow-hidden border-t border-line px-[clamp(16px,4vw,48px)] pt-[clamp(56px,8vw,112px)]">
      <div className="mx-auto max-w-[1344px]">
        <div className="grid gap-[40px] md:grid-cols-[1fr_auto] md:gap-[64px]">
          <div className="flex flex-col gap-[12px]">
            <p className="m-0 flex items-center gap-[12px] text-[clamp(28px,4vw,44px)] leading-[1.1] font-medium tracking-[-0.02em]">
              {tp("title")}
              <span aria-hidden="true" className="h-[10px] w-[10px] rounded-full bg-lime" />
            </p>
            <p className="m-0 text-[14px] text-grey">{tp("product")}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-[48px] text-[14px] md:gap-x-[72px]">
            <nav className="flex flex-col">
              <Link href="/orders" className={LINK}>
                {t("orderLookup")}
              </Link>
              <Link href="/legal/refund" className={LINK}>
                {t("shipping")}
              </Link>
              <Link href="/legal/business" className={LINK}>
                {t("contact")}
              </Link>
            </nav>
            <nav className="flex flex-col">
              <a
                href="https://www.instagram.com/suaci_/"
                target="_blank"
                rel="noopener noreferrer"
                className={`${LINK} gap-[4px]`}
              >
                {t("instagram")}
                <span aria-hidden="true" className="text-[12px]">
                  ↗
                </span>
              </a>
            </nav>
          </div>
        </div>

        <div className="mt-[clamp(48px,6vw,80px)] flex flex-col gap-[12px] border-t border-line pt-[20px] text-[12px] text-grey md:flex-row md:items-start md:justify-between md:gap-[48px]">
          <BusinessInfo />
          <div className="flex shrink-0 flex-wrap items-center gap-x-[20px]">
            <Link href="/legal/terms" className={SMALL_LINK}>
              {t("terms")}
            </Link>
            {/* 개인정보처리방침은 다른 고지와 구분되게 보여야 한다(개인정보 보호법 표시 기준) */}
            <Link href="/legal/privacy" className={`${SMALL_LINK} font-medium text-ink-soft`}>
              {t("privacy")}
            </Link>
            {/* 분석 도구가 있는 빌드에서만 — 허용·거부를 다시 고르는 길 */}
            {hasAnalytics() && (
              <ConsentSettingsButton label={tConsent("settings")} className={SMALL_LINK} />
            )}
            <span>{SITE.copyright}</span>
          </div>
        </div>
      </div>
      <Image
        src={HOME_MEDIA.logoBlack}
        alt=""
        aria-hidden="true"
        width={1608}
        height={400}
        unoptimized
        className="mx-auto mt-[clamp(32px,5vw,72px)] h-auto w-full max-w-[1344px] translate-y-[18%]"
      />
    </footer>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

/** 사이버몰 운영자 표시. 값은 constants/site BUSINESS 한 곳, 항목 이름만 언어별 */
function BusinessInfo() {
  const t = useTranslations("home.footer.business");
  const rows: Array<[keyof typeof BUSINESS & string, React.ReactNode]> = [
    ["name", BUSINESS.name],
    ["representatives", BUSINESS.representatives],
    [
      "registrationNo",
      <>
        {BUSINESS.registrationNo}{" "}
        <a
          href={BUSINESS.verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-[3px] transition-colors hover:text-ink"
        >
          {t("verify")}
        </a>
      </>,
    ],
    ["mailOrderNo", BUSINESS.mailOrderNo],
    ["cosmeticsNo", BUSINESS.cosmeticsNo],
    ["address", BUSINESS.address],
    ["phone", BUSINESS.phone],
    ["email", BUSINESS.email],
    ["privacyOfficer", BUSINESS.privacyOfficer],
  ];
  return (
    <dl className="m-0 flex max-w-[760px] flex-wrap gap-x-[16px] gap-y-[6px] leading-[1.6]">
      {rows.map(([key, value]) => (
        <div key={key} className="flex gap-[6px]">
          <dt>{t(key)}</dt>
          <dd className="m-0 text-ink-soft">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

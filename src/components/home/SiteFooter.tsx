import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HOME_MEDIA } from "@/constants/product";
import { SITE } from "@/constants/site";

/**
 * v5 푸터 — 흰 바탕. 슬로건·내비 / 법적 표기 / 하단에 잘려 나가는 대형 로고.
 * 정책 페이지는 아직 없음 → href="#" (TODO).
 */
export default function SiteFooter() {
  const t = useTranslations("home.footer");
  const tp = useTranslations("home.hero");

  return (
    <footer className="w-full overflow-hidden border-t border-line px-[clamp(16px,4vw,48px)] pt-[clamp(48px,6vw,80px)]">
      <div className="mx-auto flex max-w-[1344px] flex-col gap-[40px]">
        <div className="flex flex-wrap items-start justify-between gap-[24px]">
          <p className="m-0 text-[14px]">
            {tp("title")} <span className="text-grey">{tp("product")}</span>
          </p>
          <nav className="flex flex-wrap gap-x-[24px] gap-y-[8px] text-[13px]">
            <Link href="/orders" className="hover:text-grey">
              {t("orderLookup")}
            </Link>
            {/* TODO: 정책·연락처 페이지 */}
            <a href="#" className="hover:text-grey">
              {t("shipping")}
            </a>
            <a href="#" className="hover:text-grey">
              {t("contact")}
            </a>
            <a href="#" className="hover:text-grey">
              {t("instagram")}
            </a>
          </nav>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-[16px] text-[12px] text-grey">
          <p className="m-0">{t("legal")}</p>
          <nav className="flex flex-wrap gap-x-[20px] gap-y-[6px]">
            <a href="#" className="hover:text-ink">
              {t("terms")}
            </a>
            <a href="#" className="hover:text-ink">
              {t("privacy")}
            </a>
            <a href="#" className="hover:text-ink">
              {t("tokushoho")}
            </a>
            <span>{SITE.copyright}</span>
          </nav>
        </div>
      </div>
      <Image
        src={HOME_MEDIA.logoBlack}
        alt=""
        aria-hidden="true"
        width={1608}
        height={400}
        unoptimized
        className="mx-auto mt-[clamp(24px,4vw,56px)] h-auto w-full max-w-[1344px] translate-y-[18%]"
      />
    </footer>
  );
}

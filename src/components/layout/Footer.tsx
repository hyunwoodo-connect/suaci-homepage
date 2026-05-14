import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type LinkHref = ComponentProps<typeof Link>["href"];

/**
 * 사이트 공통 푸터 — Home v2
 *
 * 구조: 짙은 초록 배경, cream 텍스트
 * - 4컬럼 grid (1.4 / 1 / 1 / 1)
 * - 1열: 큰 suaci 워드마크 + Fraunces italic 태그라인 + 주소
 * - 2~4열: Brand / Product / Help 링크
 * - 하단 구분선 + 카피라이트 + 법적 링크
 */
export default function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="bg-green text-cream-on-green pt-[96px] pb-[36px] border-t-0">
      <div className="max-w-[1480px] mx-auto px-[18px] md:px-[32px] grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-[48px] max-lg:grid-cols-2 max-lg:gap-[36px] max-sm:grid-cols-1">
        {/* Brand column */}
        <div>
          <span className="font-en font-medium text-[64px] tracking-[-0.025em] leading-none text-cream-on-green block mb-[24px]">
            suaci
          </span>
          <div className="font-fraunces italic font-light text-[20px] leading-[1.4] max-w-[24ch] text-[#dbe6c8]">
            {t("tag1")}
            <br />
            {t("tag2")}
          </div>
          <div className="mt-[36px] font-en text-[11px] tracking-[0.06em] leading-[1.9] text-cream-on-green/55">
            {t("addrCompany")}
            <br />
            {t("addrEmail")}
            <br />
            {t("addrHours")}
          </div>
        </div>

        <FooterCol
          title={t("brandGroup")}
          links={[
            { label: t("brandStory"), href: "/#story" },
            { label: t("brandJournal"), href: "#" },
          ]}
        />
        <FooterCol
          title={t("productGroup")}
          links={[
            { label: t("productMist"), href: "/#product" },
            { label: t("productIngredients"), href: "#" },
            { label: t("productHowTo"), href: "#" },
          ]}
        />
        <FooterCol
          title={t("helpGroup")}
          links={[
            { label: t("helpFaq"), href: "#" },
            { label: t("helpContact"), href: "#" },
            { label: t("helpShipping"), href: "#" },
          ]}
        />
      </div>

      {/* Bottom bar */}
      <div className="max-w-[1480px] mx-auto mt-[60px] pt-[24px] px-[18px] md:px-[32px] border-t border-cream-on-green/[0.18] flex justify-between items-center gap-[24px] flex-wrap font-en text-[10px] tracking-[0.18em] uppercase text-cream-on-green/55">
        <span>{t("copyright")}</span>
        <div className="flex gap-[24px]">
          <a href="#" className="hover:text-white transition-colors">
            {t("terms")}
          </a>
          <a href="#" className="hover:text-white transition-colors">
            {t("privacy")}
          </a>
          <a href="#" className="hover:text-white transition-colors">
            {t("business")}
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface FooterLink {
  label: string;
  href: LinkHref;
}

interface FooterColProps {
  title: string;
  links: FooterLink[];
}

function FooterCol({ title, links }: FooterColProps) {
  return (
    <div>
      <h5 className="font-en text-[10px] tracking-[0.32em] uppercase text-cream-on-green/55 mb-[22px] font-medium m-0">
        {title}
      </h5>
      <ul className="list-none m-0 p-0 flex flex-col gap-[14px]">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-[15px] text-cream-on-green hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

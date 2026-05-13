import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type LinkHref = ComponentProps<typeof Link>["href"];

/**
 * 사이트 공통 푸터 — 매거진 톤
 *
 * 구조: 4컬럼 grid (1.4 / 1 / 1 / 1)
 * - 1열: 워드마크 + 태그라인 + 주소
 * - 2~4열: Brand / Product / Help 링크
 * - 하단 dotted rule + 카피라이트 + 법적 링크
 */
export default function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-green pt-[80px] pb-[40px] bg-background mt-[40px]">
      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-[48px] max-w-[1480px] mx-auto px-[28px] max-md:grid-cols-2 max-md:gap-[36px] max-md:px-[18px]">
        <div className="brand max-md:col-span-2">
          <span className="font-en font-medium text-[34px] block mb-[18px] tracking-[-0.01em] text-green leading-none">
            suaci
          </span>
          <div className="font-en text-[12px] leading-[1.7] text-ink-soft max-w-[28ch]">
            {t("tag1")}
            <br />
            {t("tag2")}
          </div>
          <div className="mt-[36px] font-en text-[10px] tracking-[0.06em] text-ink-mute leading-[1.85]">
            {t("addrName")}
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

      <div className="max-w-[1480px] mx-auto mt-[48px] pt-[24px] px-[28px] border-t border-dotted border-line flex justify-between gap-[24px] font-en text-[10px] tracking-[0.08em] uppercase text-ink-mute flex-wrap max-md:px-[18px] max-md:flex-col max-md:gap-[14px]">
        <div>{t("copyright")}</div>
        <div className="flex gap-[18px]">
          <a href="#" className="hover:text-green transition-colors">
            {t("terms")}
          </a>
          <a href="#" className="hover:text-green transition-colors">
            {t("privacy")}
          </a>
          <a href="#" className="hover:text-green transition-colors">
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
      <h5 className="font-en text-[10px] tracking-[0.22em] uppercase text-ink-mute mb-[18px] font-medium">
        {title}
      </h5>
      <ul className="list-none flex flex-col gap-[10px]">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-[15px] text-ink hover:text-green transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

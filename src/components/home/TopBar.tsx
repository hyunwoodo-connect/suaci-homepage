import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Home v4 상단 바 — 12컬럼 그리드 셀 (로고 / 앵커 nav / CTA).
 */
export default function TopBar() {
  const t = useTranslations("v4.nav");

  return (
    <div className="bar">
      <Link className="bar__logo" href="/">
        suaci
      </Link>
      <nav className="bar__nav">
        <a href="#product">{t("product")}</a>
        <a href="#moments">{t("moments")}</a>
        <a href="#story">{t("story")}</a>
        <a href="#order">{t("waitlist")}</a>
      </nav>
      <a className="bar__cta" href="#order">
        {t("cta")} →
      </a>
    </div>
  );
}

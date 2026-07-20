import { useTranslations } from "next-intl";

/**
 * Home v4 푸터 — 아웃라인 스트로크 워드마크 + Index/Contact 컬럼.
 */
export default function FooterV4() {
  const t = useTranslations("v4.nav");

  return (
    <>
      <div className="cell ft-mark">suaci</div>
      <div className="cell ft-col ftc1">
        <h4>Index</h4>
        <a href="#product">{t("product")}</a>
        <a href="#moments">{t("moments")}</a>
        <a href="#story">{t("story")}</a>
        <a href="#order">{t("waitlist")}</a>
      </div>
      <div className="cell ft-col ftc2">
        <h4>Contact</h4>
        <a href="#">Instagram</a>
        <a href="#">Newsletter</a>
        <a href="mailto:hello@suaci.com">hello@suaci.com</a>
      </div>
      <div className="cell ft-bottom">
        <span>© 2026 SUACI — Calm, not cured.</span>
        <span>Made for the middle of the day.</span>
      </div>
    </>
  );
}

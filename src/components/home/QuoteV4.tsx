import { useTranslations } from "next-intl";

/**
 * Home v4 인용 셀 — Fraunces 이탤릭 대형 문장.
 */
export default function QuoteV4() {
  const t = useTranslations("v4.quote");

  return (
    <div className="quote" id="story">
      <p>
        {t("pre")} <b>{t("bold")}</b>{t("post")}
      </p>
      <span className="mono">SUACI — 2026, launching soon</span>
    </div>
  );
}

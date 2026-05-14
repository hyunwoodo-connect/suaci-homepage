import { useTranslations } from "next-intl";

/**
 * Rulebar — 히어로 아래 얇은 정보 스트립.
 *
 * 제품명, 용량, 특성, 슬로건을 한 줄에 배치.
 * 초록 점(dot)으로 구분.
 */
export default function RulebarSection() {
  const t = useTranslations("rulebar");

  return (
    <section className="bg-background border-t border-line border-b border-b-line">
      <div className="max-w-[1480px] mx-auto px-[18px] md:px-[32px] py-[18px] flex items-center gap-[24px] flex-wrap font-en text-[11px] tracking-[0.22em] uppercase text-ink-mute">
        <span>
          {t("brand")}{" "}
          <b className="font-semibold text-ink tracking-[0.18em]">
            {t("product")}
          </b>
        </span>
        <Dot />
        <span>
          {t("volume")}{" "}
          <b className="font-semibold text-ink tracking-[0.18em]">
            {t("volumeUnit")}
          </b>
        </span>
        <Dot />
        <span>{t("feature")}</span>
        <Dot />
        <span>{t("launch")}</span>
        <span className="flex-1" />
        <span>{t("slogan")}</span>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function Dot() {
  return (
    <span className="w-[6px] h-[6px] rounded-full bg-green opacity-70" />
  );
}

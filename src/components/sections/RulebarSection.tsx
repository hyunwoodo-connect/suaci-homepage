import { useTranslations } from "next-intl";

/**
 * Rulebar — 히어로 아래 얇은 정보 스트립.
 *
 * 데스크탑: 한 줄에 전체 정보
 * 모바일: 브랜드 + 슬로건만 깔끔하게 중앙 정렬
 */
export default function RulebarSection() {
  const t = useTranslations("rulebar");

  return (
    <section className="bg-background border-t border-line border-b border-b-line">
      {/* Desktop */}
      <div className="max-w-[1480px] mx-auto px-[18px] md:px-[32px] py-[18px] items-center gap-[24px] font-en text-[11px] tracking-[0.22em] uppercase text-ink-mute hidden md:flex">
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

      {/* Mobile */}
      <div className="md:hidden px-[18px] py-[14px] flex items-center justify-center gap-[12px] font-en text-[10px] tracking-[0.22em] uppercase text-ink-mute">
        <span className="font-semibold text-ink tracking-[0.18em]">
          {t("brand")}
        </span>
        <Dot />
        <span>{t("slogan")}</span>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function Dot() {
  return (
    <span className="w-[6px] h-[6px] rounded-full bg-green opacity-70 flex-shrink-0" />
  );
}

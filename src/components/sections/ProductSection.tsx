import { useTranslations } from "next-intl";
import { SECTION_PADDING_X } from "@/constants/site";

/**
 * 단일 제품 쇼케이스 섹션
 *
 * 레이아웃: 이미지(좌) + 제품 정보(우) 2컬럼
 * 모바일: 이미지 위 → 정보 아래 스택
 */
export default function ProductSection() {
  const t = useTranslations("product");

  const ingredients = ["Centella Asiatica", "Menthol", "Hyaluronic Acid", "Aloe Vera", "Panthenol"];

  return (
    <section id="product" className="py-20 md:py-32">
      <div className={`max-w-[1400px] mx-auto ${SECTION_PADDING_X}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 lg:gap-24 items-center">
          {/* 좌측 — 제품 이미지 */}
          <div className="relative aspect-[3/4] bg-[#f5f5f5] overflow-hidden">
            {/* 제품 이미지 플레이스홀더 — 실제 이미지로 교체 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs tracking-[0.2em] text-muted">
                PRODUCT IMAGE
              </span>
            </div>
          </div>

          {/* 우측 — 제품 정보 */}
          <div>
            <p className="text-[10px] sm:text-xs tracking-[0.2em] text-muted mb-3">
              {t("subtitle")}
            </p>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-[-0.02em] leading-[1.2] mb-2">
              {t("name")}
            </h2>

            <p className="text-sm text-muted mb-6">{t("size")}</p>

            {/* 핵심 가치 3가지 */}
            <div className="flex flex-col gap-5 mb-8">
              <BenefitItem
                number="01"
                title={t("benefit1Title")}
                description={t("benefit1Desc")}
              />
              <BenefitItem
                number="02"
                title={t("benefit2Title")}
                description={t("benefit2Desc")}
              />
              <BenefitItem
                number="03"
                title={t("benefit3Title")}
                description={t("benefit3Desc")}
              />
            </div>

            {/* 핵심 성분 */}
            <div className="border-t border-border pt-6 mb-8">
              <p className="text-[10px] tracking-[0.15em] text-muted mb-3">
                {t("keyIngredients")}
              </p>
              <div className="flex flex-wrap gap-2">
                {ingredients.map((ingredient) => (
                  <span
                    key={ingredient}
                    className="text-xs tracking-[-0.01em] px-3 py-1.5 border border-border text-foreground/70"
                  >
                    {ingredient}
                  </span>
                ))}
              </div>
            </div>

            {/* 가격 + CTA */}
            <div className="flex items-center gap-6">
              <span className="text-2xl font-bold tracking-[-0.02em]">
                {t("price")}
              </span>
              <button className="bg-foreground text-white text-xs tracking-[0.1em] font-semibold px-8 py-3.5 hover:bg-foreground/80 transition-colors">
                {t("cta")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────────── */

function BenefitItem({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <span className="text-[10px] tracking-[0.1em] text-[#A9FF39] font-bold mt-1">
        {number}
      </span>
      <div>
        <p className="text-sm font-semibold tracking-[0.02em] mb-1">{title}</p>
        <p className="text-xs text-muted leading-[1.6] tracking-[-0.01em]">
          {description}
        </p>
      </div>
    </div>
  );
}

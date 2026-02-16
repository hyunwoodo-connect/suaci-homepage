"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { SECTION_PADDING_X } from "@/constants/site";

interface ProductSectionProps {
  images?: string[];
}

/**
 * 단일 제품 쇼케이스 섹션
 *
 * 좌측: 이미지 슬라이드 + 인디케이터
 * 우측: 제품 정보
 *
 * images prop으로 이미지 경로 배열을 받으며,
 * 미전달 시 기본 3장 사용
 */
const DEFAULT_IMAGES = ["/detail-cut/1.png", "/detail-cut/2.png", "/detail-cut/3.png"];

export default function ProductSection({ images }: ProductSectionProps) {
  const productImages = images && images.length > 0 ? images : DEFAULT_IMAGES;
  const t = useTranslations("product");
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % productImages.length);
  }, [productImages.length]);

  useEffect(() => {
    const id = setInterval(next, 3000);
    return () => clearInterval(id);
  }, [next]);

  const ingredients = [
    "Centella Asiatica",
    "Menthol",
    "Hyaluronic Acid",
    "Aloe Vera",
    "Panthenol",
  ];

  return (
    <section id="product" className="py-16 md:py-24">
      <div className={`max-w-[1400px] mx-auto ${SECTION_PADDING_X}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 lg:gap-24 items-start">
          {/* 좌측 — 이미지 슬라이드 */}
          <div>
            <div
              className="relative aspect-square overflow-hidden bg-[#f2f2f2]"
            >
              {productImages.map((src, i) => (
                <Image
                  key={src}
                  src={src}
                  alt={`${t("name")} ${i + 1}`}
                  fill
                  className={`object-cover object-center transition-opacity duration-500 ${
                    i === current ? "opacity-100" : "opacity-0"
                  }`}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority={i === 0}
                />
              ))}
            </div>

            {/* 인디케이터 */}
            <div className="flex items-center gap-2 mt-4">
              {productImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-[2px] transition-all duration-300 ${
                    i === current
                      ? "w-8 bg-foreground"
                      : "w-4 bg-foreground/20 hover:bg-foreground/40"
                  }`}
                  aria-label={`Image ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* 우측 — 제품 정보 */}
          <div className="flex flex-col justify-between h-full">
            <div>
              <p className="text-[10px] sm:text-xs tracking-[0.3em] text-foreground/40 mb-4">
                {t("subtitle")}
              </p>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-[-0.03em] leading-[1.1] mb-1">
                {t("name")}
              </h2>

              <p className="text-xs tracking-[0.1em] text-foreground/40 mb-10">
                {t("size")}
              </p>

              {/* 핵심 가치 — 수평 구분선 스타일 */}
              <div className="border-t border-foreground/10">
                <BenefitItem
                  title={t("benefit1Title")}
                  description={t("benefit1Desc")}
                />
                <BenefitItem
                  title={t("benefit2Title")}
                  description={t("benefit2Desc")}
                />
                <BenefitItem
                  title={t("benefit3Title")}
                  description={t("benefit3Desc")}
                />
              </div>
            </div>

            {/* 하단 — 성분 + 가격/CTA */}
            <div className="mt-10">
              {/* 핵심 성분 */}
              <p className="text-[10px] tracking-[0.3em] text-foreground/40 mb-3">
                {t("keyIngredients")}
              </p>
              <p className="text-xs tracking-[0.02em] text-foreground/70 leading-relaxed mb-10">
                {ingredients.join(" · ")}
              </p>

              {/* 가격 + CTA */}
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold tracking-[-0.02em]">
                  {t("price")}
                </span>
                <button className="bg-foreground text-white text-[11px] tracking-[0.15em] font-medium px-10 py-4 hover:bg-foreground/85 transition-colors">
                  {t("cta")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────────── */

function BenefitItem({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-foreground/10 py-5 flex items-baseline justify-between gap-6">
      <span className="text-xs font-semibold tracking-[0.05em] shrink-0">
        {title}
      </span>
      <p className="text-xs text-foreground/50 leading-[1.6] text-right">
        {description}
      </p>
    </div>
  );
}

/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatKRW, discountPercent, effectivePrice } from "@/lib/format";
import type { ProductSummary, Money } from "@/types";

interface ProductCardProps {
  product: ProductSummary;
  /** 대표 variant 가격 (있으면 가격·할인율 노출). listProducts summary엔 없어 optional. */
  price?: Money;
  /** 로드 순서 stagger용 인덱스 (0-base). */
  index?: number;
}

/**
 * 큐레이션 샵 카드 — v4 acid grid DNA(1.5px 잉크 보더 · 모노 캡션 · Fraunces em).
 * 이미지 · 브랜드/이름(nameKo) · 카테고리 캡션 · 가격/할인 배지 · 품절 상태.
 */
export default function ProductCard({ product, price, index = 0 }: ProductCardProps) {
  const t = useTranslations("shop");
  const [imgOk, setImgOk] = useState(true);
  const soldout = product.status === "soldout";
  const src = product.images[0];
  const pct = price ? discountPercent(price) : null;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="pc group block border-[1.5px] border-ink bg-paper no-underline text-ink"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      {/* 이미지 프레임 */}
      <div className="relative overflow-hidden bg-ink aspect-[4/5] border-b-[1.5px] border-ink">
        <span className="cell__tag cell__tag--tr" style={{ color: "var(--color-paper)" }}>
          {product.category.toUpperCase()}
        </span>
        {imgOk && src ? (
          <img
            src={src}
            alt={product.nameKo}
            onError={() => setImgOk(false)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <span className="font-display text-[13vw] sm:text-[52px] font-bold uppercase tracking-[-0.04em] text-paper/15 select-none">
              suaci
            </span>
          </div>
        )}
        {pct && !soldout && (
          <span className="absolute left-0 top-0 bg-acid text-ink font-mono text-[11px] font-bold px-[9px] py-[4px] tracking-[0.02em]">
            −{pct}%
          </span>
        )}
        {soldout && (
          <span className="absolute inset-0 grid place-items-center bg-ink/45">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-paper border border-paper px-[12px] py-[6px]">
              {t("soldout")}
            </span>
          </span>
        )}
      </div>

      {/* 정보 */}
      <div className="flex flex-col gap-[6px] p-[16px]">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey">
          {product.category}
        </span>
        <b className="font-display text-[16px] leading-[1.25] tracking-[-0.01em]">
          {product.nameKo}
        </b>
        {product.descriptor && (
          <span className="text-[12.5px] leading-[1.55] text-grey line-clamp-2">
            {product.descriptor}
          </span>
        )}
        {price ? (
          <div className="mt-[4px] flex items-baseline gap-[8px]">
            <b className="font-display text-[16px] num tracking-[-0.01em]">
              {formatKRW(effectivePrice(price))}
            </b>
            {pct && (
              <span className="font-mono text-[11px] text-grey line-through num">
                {formatKRW(price.list)}
              </span>
            )}
          </div>
        ) : (
          <span className="mt-[4px] font-mono text-[11px] uppercase tracking-[0.08em] text-acid-deep">
            {t("view")} →
          </span>
        )}
      </div>
    </Link>
  );
}

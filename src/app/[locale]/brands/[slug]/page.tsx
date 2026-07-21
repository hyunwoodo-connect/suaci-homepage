/* eslint-disable @next/next/no-img-element */
"use client";

import { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import PageShell from "@/components/shell/PageShell";
import ProductCard from "@/components/shop/ProductCard";
import { api, ApiClientError } from "@/lib/api";
import type { Brand, Money, ProductSummary } from "@/types";

type Phase = "loading" | "ready" | "notFound" | "error";

/**
 * 브랜드 상세 — getBrand(slug) + listProducts({brandId}). 헤더 + 제품 그리드(ProductCard 재사용).
 */
export default function BrandDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const t = useTranslations("brands");

  const [brand, setBrand] = useState<Brand | null>(null);
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [prices, setPrices] = useState<Record<string, Money>>({});
  const [phase, setPhase] = useState<Phase>("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const b = await api.getBrand(slug);
        if (!active) return;
        setBrand(b);
        const page = await api.listProducts({ brandId: b.brandId });
        if (!active) return;
        setItems(page.data);
        setPhase("ready");

        const entries = await Promise.all(
          page.data.map(async (s): Promise<[string, Money] | null> => {
            try {
              const full = await api.getProduct(s.slug);
              const variant =
                full.variants.find((v) => v.variantId === full.defaultVariantId) ??
                full.variants[0];
              return variant ? [s.productId, variant.price] : null;
            } catch {
              return null;
            }
          }),
        );
        if (!active) return;
        setPrices(() => {
          const next: Record<string, Money> = {};
          for (const e of entries) if (e) next[e[0]] = e[1];
          return next;
        });
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiClientError && err.code === "BRAND_NOT_FOUND") {
          setPhase("notFound");
        } else {
          setPhase("error");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  if (phase === "loading") {
    return (
      <PageShell no="BR" title={<>The <em>brands</em></>} meta="">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey m-0">
          {t("loading")}
        </p>
      </PageShell>
    );
  }

  if (phase === "notFound" || phase === "error" || !brand) {
    return (
      <PageShell no="BR" title={<>The <em>brands</em></>} meta="">
        <div className="max-w-[440px] flex flex-col items-start gap-[16px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#c0392b] m-0">
            ✕ {phase === "notFound" ? t("empty") : t("error")}
          </p>
          <Link href="/brands">
            <Button variant="outline">← {t("meta")}</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell no="BR" title={<>{brand.name}</>} meta={brand.nameKo}>
      <div className="max-w-[1080px]">
        {/* 브랜드 헤더 */}
        <div className="flex items-start gap-[18px] border-[1.5px] border-ink p-[20px] mb-[28px]">
          {brand.logo ? (
            <img
              src={brand.logo}
              alt={brand.name}
              className="h-[56px] w-[56px] shrink-0 object-contain border-[1.5px] border-line bg-paper"
            />
          ) : (
            <span className="grid h-[56px] w-[56px] shrink-0 place-items-center border-[1.5px] border-ink font-display text-[20px] font-bold">
              {brand.name.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0">
            <b className="font-display text-[20px] tracking-[-0.01em] block">{brand.nameKo}</b>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey">
              {brand.name}
            </span>
            {brand.description && (
              <p className="text-[13.5px] leading-[1.7] text-ink mt-[10px] mb-0 max-w-[52ch]">
                {brand.description}
              </p>
            )}
          </div>
        </div>

        {/* 제품 그리드 */}
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey block mb-[14px]">
          {t("productsMeta")}
        </span>
        {items.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey m-0">
            {t("noProducts")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 md:grid-cols-3">
            {items.map((product, i) => (
              <ProductCard
                key={product.productId}
                product={product}
                price={prices[product.productId]}
                index={i}
              />
            ))}
          </div>
        )}

        <Link
          href="/brands"
          className="mt-[28px] inline-block font-mono text-[11px] uppercase tracking-[0.08em] text-grey hover:text-ink"
        >
          ← {t("meta")}
        </Link>
      </div>
    </PageShell>
  );
}

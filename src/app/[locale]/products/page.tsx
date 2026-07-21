"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/Button";
import PageShell from "@/components/shell/PageShell";
import ProductCard from "@/components/shop/ProductCard";
import { api, ApiClientError } from "@/lib/api";
import type { Money, ProductSummary } from "@/types";

/**
 * 큐레이션 샵 리스트 — listProducts → 반응형 카드 그리드.
 * summary엔 가격이 없어 대표 variant 가격을 병렬로 보강(mock 5개, 저렴).
 */
export default function ProductsPage() {
  const t = useTranslations("shop");
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [prices, setPrices] = useState<Record<string, Money>>({});
  const [cursor, setCursor] = useState<string | undefined>();
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [loadingMore, setLoadingMore] = useState(false);

  const enrich = useCallback(async (data: ProductSummary[]) => {
    const entries = await Promise.all(
      data.map(async (s): Promise<[string, Money] | null> => {
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
    setPrices((prev) => {
      const next = { ...prev };
      for (const e of entries) if (e) next[e[0]] = e[1];
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const page = await api.listProducts();
        if (!active) return;
        setItems(page.data);
        setCursor(page.cursor);
        setPhase("ready");
        await enrich(page.data);
      } catch {
        if (active) setPhase("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [enrich]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await api.listProducts({ cursor });
      setItems((prev) => [...prev, ...page.data]);
      setCursor(page.cursor);
      await enrich(page.data);
    } catch (err) {
      if (err instanceof ApiClientError) setPhase("error");
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, enrich]);

  return (
    <PageShell no="SH" title={<>The <em>shop</em></>} meta={t("meta")}>
      <div className="max-w-[1080px]">
        {phase === "loading" && (
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey m-0">
            {t("loading")}
          </p>
        )}

        {phase === "error" && (
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#c0392b] m-0">
            ✕ {t("error")}
          </p>
        )}

        {phase === "ready" && items.length === 0 && (
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey m-0">
            {t("empty")}
          </p>
        )}

        {phase === "ready" && items.length > 0 && (
          <>
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

            {cursor && (
              <div className="mt-[28px] flex justify-center">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "..." : t("loadMore")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}

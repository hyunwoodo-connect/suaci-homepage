/* eslint-disable @next/next/no-img-element */
"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import PageShell from "@/components/shell/PageShell";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { useCart } from "@/lib/cart/cart-context";
import { formatKRW, discountPercent, effectivePrice } from "@/lib/format";
import type { Product, Variant } from "@/types";

type Phase = "loading" | "ready" | "notFound" | "error";

/**
 * PDP — getProduct(slug). 이미지 상단 풀블리드 + 정보 하단(모바일 우선).
 * variant 선택 · 담기(로그인 게이트) · 바로구매 · 담김 확인 · 404 처리.
 */
export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const t = useTranslations("product");
  const tShop = useTranslations("shop");
  const router = useRouter();
  const { status } = useAuth();
  const { add } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [variantId, setVariantId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const p = await api.getProduct(slug);
        if (!active) return;
        setProduct(p);
        setVariantId(p.defaultVariantId ?? p.variants[0]?.variantId);
        setPhase("ready");
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiClientError && err.code === "PRODUCT_NOT_FOUND") {
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

  const selected: Variant | undefined = useMemo(
    () => product?.variants.find((v) => v.variantId === variantId),
    [product, variantId],
  );

  const soldout =
    product?.status === "soldout" ||
    !selected ||
    selected.status === "soldout" ||
    selected.available <= 0;

  const handleAdd = async (thenGoToCart: boolean) => {
    if (!product || !selected) return;
    if (status !== "authenticated") {
      router.push(`/login?next=/products/${slug}`);
      return;
    }
    setBusy(true);
    setAdded(false);
    try {
      await add({
        productId: product.productId,
        variantId: selected.variantId,
        quantity: 1,
      });
      if (thenGoToCart) {
        router.push("/cart");
      } else {
        setAdded(true);
      }
    } finally {
      setBusy(false);
    }
  };

  if (phase === "loading") {
    return (
      <PageShell no="SH" title={<>The <em>shop</em></>} meta="">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey m-0">
          {t("loading")}
        </p>
      </PageShell>
    );
  }

  if (phase === "notFound" || phase === "error" || !product) {
    const notFound = phase === "notFound";
    return (
      <PageShell no="SH" title={<>The <em>shop</em></>} meta="">
        <div className="max-w-[440px] flex flex-col items-start gap-[16px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#c0392b] m-0">
            ✕ {notFound ? t("notFound") : t("error")}
          </p>
          {notFound && (
            <p className="text-[14px] text-ink m-0 leading-[1.7]">{t("notFoundBody")}</p>
          )}
          <Link href="/products">
            <Button variant="outline">{t("backToShop")}</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  const price = selected?.price;
  const pct = price ? discountPercent(price) : null;
  const heroSrc = product.images[imgIdx];

  return (
    <PageShell
      no="SH"
      title={<>{product.name}</>}
      meta={product.category}
    >
      <div className="max-w-[1080px]">
        <div className="grid grid-cols-1 gap-[28px] lg:grid-cols-2 lg:gap-[40px] lg:items-start">
          {/* 이미지 — 모바일 상단 풀블리드 */}
          <div className="flex flex-col gap-[12px]">
            <div className="relative overflow-hidden bg-ink aspect-[4/5] border-[1.5px] border-ink">
              <span className="cell__tag cell__tag--tr" style={{ color: "var(--color-paper)" }}>
                {product.category.toUpperCase()}
              </span>
              {imgOk && heroSrc ? (
                <img
                  src={heroSrc}
                  alt={product.nameKo}
                  onError={() => setImgOk(false)}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <span className="font-display text-[80px] font-bold uppercase tracking-[-0.04em] text-paper/15 select-none">
                    suaci
                  </span>
                </div>
              )}
              {soldout && (
                <span className="absolute inset-0 grid place-items-center bg-ink/45">
                  <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-paper border border-paper px-[14px] py-[7px]">
                    {t("soldout")}
                  </span>
                </span>
              )}
            </div>

            {product.images.length > 1 && (
              <div className="flex gap-[8px]">
                {product.images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => {
                      setImgIdx(i);
                      setImgOk(true);
                    }}
                    aria-label={`${product.nameKo} ${i + 1}`}
                    className={`h-[56px] w-[56px] shrink-0 overflow-hidden border-[1.5px] transition-colors ${
                      i === imgIdx ? "border-ink" : "border-line"
                    }`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 정보 */}
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey">
              {product.category}
            </span>
            <h2 className="font-display text-[28px] leading-[1.15] tracking-[-0.01em] mt-[8px] mb-[4px]">
              {product.nameKo}
            </h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey">
              {product.name}
            </span>

            {product.descriptor && (
              <p className="text-[14.5px] leading-[1.8] text-ink mt-[16px] mb-0 max-w-[46ch]">
                {product.descriptor}
              </p>
            )}

            {/* 가격 */}
            {price && (
              <div className="mt-[22px] flex items-baseline gap-[10px]">
                <b className="font-display text-[26px] num tracking-[-0.01em]">
                  {formatKRW(effectivePrice(price))}
                </b>
                {pct && (
                  <>
                    <span className="font-mono text-[13px] text-grey line-through num">
                      {formatKRW(price.list)}
                    </span>
                    <span className="bg-acid text-ink font-mono text-[11px] font-bold px-[8px] py-[3px]">
                      −{pct}% {t("off")}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* variant 선택 */}
            {product.variants.length > 1 && (
              <div className="mt-[24px]">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey block mb-[10px]">
                  {t("selectOption")}
                </span>
                <div className="flex flex-wrap gap-[8px]">
                  {product.variants.map((v) => {
                    const vSoldout = v.status === "soldout" || v.available <= 0;
                    const active = v.variantId === variantId;
                    return (
                      <button
                        key={v.variantId}
                        type="button"
                        disabled={vSoldout}
                        onClick={() => {
                          setVariantId(v.variantId);
                          setAdded(false);
                        }}
                        className={`px-[14px] py-[10px] font-mono text-[12px] uppercase tracking-[0.06em] border-[1.5px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          active
                            ? "border-ink bg-ink text-acid"
                            : "border-ink text-ink hover:bg-ink hover:text-acid"
                        }`}
                      >
                        {v.optionName}
                        {vSoldout ? ` · ${t("soldout")}` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 액션 */}
            <div className="mt-[28px] flex flex-col gap-[10px] max-w-[420px]">
              <Button onClick={() => handleAdd(false)} disabled={busy || soldout}>
                {soldout ? t("soldout") : busy ? "..." : t("addToBag")}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAdd(true)}
                disabled={busy || soldout}
              >
                {t("buyNow")}
              </Button>

              {added && (
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-acid-deep m-0 mt-[4px]">
                  ✓ {t("added")}{" "}
                  <Link
                    href="/cart"
                    className="text-ink underline underline-offset-[3px] hover:text-acid-deep"
                  >
                    {t("viewCart")} →
                  </Link>
                </p>
              )}
            </div>

            <Link
              href="/products"
              className="mt-[32px] font-mono text-[11px] uppercase tracking-[0.08em] text-grey hover:text-ink"
            >
              ← {tShop("meta")}
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

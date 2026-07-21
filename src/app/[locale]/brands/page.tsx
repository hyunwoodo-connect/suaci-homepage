/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/shell/PageShell";
import { api } from "@/lib/api";
import type { Brand } from "@/types";

type Phase = "loading" | "ready" | "error";

/**
 * 브랜드 리스트 — listBrands. 큐레이션 정체성(수아치가 고른 파트너).
 */
export default function BrandsPage() {
  const t = useTranslations("brands");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const page = await api.listBrands();
        if (!active) return;
        setBrands(page.data.filter((b) => b.status === "active"));
        setPhase("ready");
      } catch {
        if (active) setPhase("error");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <PageShell no="BR" title={<>The <em>brands</em></>} meta={t("meta")}>
      <div className="max-w-[860px]">
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
        {phase === "ready" && brands.length === 0 && (
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey m-0">
            {t("empty")}
          </p>
        )}
        {phase === "ready" && brands.length > 0 && (
          <ul className="list-none m-0 p-0 border-[1.5px] border-ink">
            {brands.map((brand) => (
              <li key={brand.brandId} className="border-b-[1.5px] border-ink last:border-b-0">
                <Link
                  href={`/brands/${brand.slug}`}
                  className="group flex items-center gap-[18px] px-[18px] py-[20px] no-underline text-ink hover:bg-ink/[0.03] transition-colors"
                >
                  {brand.logo ? (
                    <img
                      src={brand.logo}
                      alt={brand.name}
                      className="h-[44px] w-[44px] shrink-0 object-contain border-[1.5px] border-line bg-paper"
                    />
                  ) : (
                    <span className="grid h-[44px] w-[44px] shrink-0 place-items-center border-[1.5px] border-ink font-display text-[15px] font-bold">
                      {brand.name.slice(0, 1)}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <b className="font-display text-[17px] tracking-[-0.01em] block">
                      {brand.nameKo}
                    </b>
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey">
                      {brand.name}
                    </span>
                    {brand.description && (
                      <p className="text-[13px] leading-[1.6] text-grey mt-[6px] mb-0">
                        {brand.description}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-[13px] text-grey group-hover:text-acid-deep transition-colors">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}

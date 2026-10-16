import Image from "next/image";
import { useTranslations } from "next-intl";
import { HOME_MEDIA, PRODUCT } from "@/constants/product";
import { formatKRW } from "@/lib/format";

/**
 * v5 제품 섹션 — 단일 SKU. 구매 CTA는 두지 않는다(하단 원클릭 바가 유일한 CTA).
 * 좌측 이미지는 실제 제품 출시 전까지 레퍼런스 사진 + 교체 태그.
 */
export default function ProductSection() {
  const t = useTranslations("home.product");

  return (
    <section
      id="product"
      aria-label={t("name")}
      className="w-full border-t border-line px-[16px] py-[clamp(72px,9vw,140px)] md:px-[48px]"
    >
      <div className="mx-auto flex max-w-[1344px] flex-wrap items-start gap-x-[clamp(32px,6vw,96px)] gap-y-[40px]">
        <figure className="relative m-0 w-[max(46%,min(100%,320px))] bg-studio">
          <Image
            src={HOME_MEDIA.productReference}
            alt={t("imageAlt")}
            width={681}
            height={782}
            sizes="(max-width: 767px) 92vw, 46vw"
            className="h-auto w-full"
          />
          {/* TODO(출시): 실제 suaci 보틀 컷으로 교체 — 타사 레퍼런스 사진 */}
          <figcaption className="absolute left-[12px] top-[12px] bg-ink px-[8px] py-[4px] text-[11px] text-paper">
            {t("referenceTag")}
          </figcaption>
        </figure>

        <div className="flex min-w-[260px] flex-1 flex-col gap-[28px] md:max-w-[440px] md:pt-[24px]">
          <div className="flex flex-col gap-[6px]">
            <h2 className="m-0 text-[clamp(28px,3vw,40px)] font-normal leading-[1.1] tracking-[-0.035em]">
              {t("name")}
            </h2>
            <p className="m-0 text-[14px] text-grey">{t("descriptor")}</p>
          </div>
          <p className="num m-0 text-[20px] tracking-[-0.02em]">{formatKRW(PRODUCT.price)}</p>
          <p className="m-0 max-w-[340px] text-[14px] leading-[1.6] text-ink-soft">{t("note")}</p>

          <div className="border-t border-line">
            <Detail title={t("howToUse")} body={t("howToUseBody")} />
            <Detail title={t("ingredients")} body={t("ingredientsBody")} />
            <Detail title={t("shipping")} body={t("shippingBody")} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function Detail({ title, body }: { title: string; body: string }) {
  return (
    <details className="home-details border-b border-line">
      <summary className="flex items-center justify-between py-[16px] text-[14px]">
        {title}
        <span aria-hidden="true" className="home-details__icon text-[18px] leading-none text-grey transition-transform duration-300">
          +
        </span>
      </summary>
      <p className="m-0 pb-[18px] text-[13px] leading-[1.65] text-grey">{body}</p>
    </details>
  );
}

import Image from "next/image";
import { useTranslations } from "next-intl";
import { HOME_MEDIA, PRODUCT } from "@/constants/product";
import { formatKRW } from "@/lib/format";

/**
 * v5 제품 섹션 — 단일 SKU. 구매 CTA는 두지 않는다(하단 원클릭 바가 유일한 CTA).
 * 큰 스튜디오 컷 + 텍스트, 아래에 작은 디테일 컷 2장이 무드 갤러리처럼 엇갈려 놓인다.
 * 세 사진 모두 실제 제품 출시 전까지 타사 레퍼런스 + 교체 태그. TODO(출시): suaci 보틀 컷으로 교체.
 */
export default function ProductSection() {
  const t = useTranslations("home.product");

  return (
    <section
      id="product"
      aria-label={t("name")}
      className="w-full border-t border-line px-[16px] py-[clamp(72px,9vw,140px)] md:px-[48px]"
    >
      <div className="mx-auto flex max-w-[1344px] flex-wrap items-start gap-x-[clamp(24px,4vw,64px)] gap-y-[clamp(40px,5vw,72px)]">
        <p className="m-0 flex w-full items-center gap-[10px] text-[12px] text-grey">
          <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-lime" />
          {t("label")}
        </p>

        <ReferenceFigure
          src={HOME_MEDIA.productReference}
          alt={t("imageAlt")}
          w={681}
          h={782}
          aspect="aspect-[4/5]"
          sizes="(max-width: 767px) 92vw, 40vw"
          tag={t("referenceTag")}
          className="w-[max(40%,min(100%,320px))]"
        />

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-[28px] pt-[clamp(0px,2vw,24px)] md:max-w-[440px]">
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

        {/* 디테일 컷 2장 — 한 줄을 강제로 차지해 큰 컷/텍스트 아래에서 엇갈린다. */}
        <div className="flex w-full items-start justify-between gap-[20px]">
          <ReferenceFigure
            src={HOME_MEDIA.productReferenceGrass}
            alt={t("grassAlt")}
            w={736}
            h={981}
            aspect="aspect-[3/4]"
            sizes="(max-width: 767px) 46vw, 22vw"
            tag={t("referenceTagShort")}
            caption={t("grassCaption")}
            className="ml-[max(0px,8%)] w-[max(22%,min(46%,200px))]"
          />
          <ReferenceFigure
            src={HOME_MEDIA.productReferencePour}
            alt={t("pourAlt")}
            w={1024}
            h={1024}
            aspect="aspect-square"
            sizes="(max-width: 767px) 46vw, 26vw"
            tag={t("referenceTagShort")}
            caption={t("pourCaption")}
            className="mt-[clamp(0px,5vw,80px)] w-[max(26%,min(46%,220px))]"
          />
        </div>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface ReferenceFigureProps {
  src: string;
  alt: string;
  w: number;
  h: number;
  aspect: string;
  sizes: string;
  tag: string;
  caption?: string;
  className: string;
}

function ReferenceFigure({ src, alt, w, h, aspect, sizes, tag, caption, className }: ReferenceFigureProps) {
  return (
    <figure className={`m-0 flex flex-col gap-[10px] ${className}`}>
      <div className="relative bg-studio">
        <Image src={src} alt={alt} width={w} height={h} sizes={sizes} className={`${aspect} h-auto w-full object-cover`} />
        <figcaption className="absolute left-[12px] top-[12px] bg-ink px-[8px] py-[4px] text-[11px] text-paper">
          {tag}
        </figcaption>
      </div>
      {caption && <p className="m-0 text-[13px] text-grey">{caption}</p>}
    </figure>
  );
}

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

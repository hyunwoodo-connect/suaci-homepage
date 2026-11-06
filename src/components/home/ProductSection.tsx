import { useTranslations } from "next-intl";

import PhotoSoon from "@/components/home/PhotoSoon";
import ReturnNotice from "@/components/legal/ReturnNotice";
import { CHECKOUT_PRICING } from "@/constants/checkout";
import { PRODUCT } from "@/constants/product";
import { formatKRW } from "@/lib/format";

/**
 * v5 제품 섹션 — 단일 SKU. 구매 CTA는 두지 않는다(하단 원클릭 바가 유일한 CTA).
 * 큰 제품 컷 자리 + 텍스트. 제품 사진이 나오기 전에는 '준비 중' 자리만 둔다(다른 브랜드 사진은 공개하지 않는다).
 * TODO(출시): suaci 보틀 컷으로 교체.
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

        <PhotoSoon label={t("photoSoon")} className="w-[max(40%,min(100%,320px))]" />

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
            {/* 사용법·전성분은 실제 내용이 나올 때까지 메시지를 비워 두고 칸을 숨긴다(자리 표시 문구를 손님에게 보이지 않게) */}
            {t("howToUseBody") && <Detail title={t("howToUse")} body={t("howToUseBody")} />}
            {t("ingredientsBody") && (
              <Detail title={t("ingredients")} body={t("ingredientsBody")} />
            )}
            {/* 배송·교환·환불 안내 2판의 요약. 금액은 주문서와 같은 상수에서 — 바뀌면 정책 문서(관리 툴)도 같이 */}
            <Detail
              title={t("shipping")}
              body={t("shippingBody", {
                fee: formatKRW(CHECKOUT_PRICING.shippingFee),
                freeOver: formatKRW(CHECKOUT_PRICING.freeShippingOver),
              })}
            />
          </div>
          {/* 접힌 배송·반품 안에 두지 않는다 — 펼치지 않아도 보여야 한다 */}
          <ReturnNotice className="-mt-[12px]" />
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
        <span
          aria-hidden="true"
          className="home-details__icon text-[18px] leading-none text-grey transition-transform duration-300"
        >
          +
        </span>
      </summary>
      <p className="m-0 pb-[18px] text-[13px] leading-[1.65] text-grey">{body}</p>
    </details>
  );
}

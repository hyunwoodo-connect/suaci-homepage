import { hasLocale, useLocale, useTranslations } from "next-intl";

import ProductShot from "@/components/home/ProductShot";
import ReturnNotice from "@/components/legal/ReturnNotice";
import { CHECKOUT_PRICING } from "@/constants/checkout";
import { allergenLine, ingredientLine } from "@/constants/ingredients";
import { PRODUCT, PRODUCT_PHOTOS } from "@/constants/product";
import { productNoticeRows, usageText } from "@/constants/product-notice";
import { routing } from "@/i18n/routing";
import { formatKRW } from "@/lib/format";

/**
 * v5 제품 섹션 — 단일 SKU. 구매 CTA는 두지 않는다(하단 원클릭 바가 유일한 CTA).
 * 큰 제품 컷 + 텍스트. 실제 제품 사진(`PRODUCT_PHOTOS.main`)이 오기 전에는 '준비 중' 자리만 둔다(다른 브랜드·AI 사진은 공개하지 않는다).
 */
export default function ProductSection() {
  const t = useTranslations("home.product");
  const locale = useLocale();

  const roundTripFee = CHECKOUT_PRICING.shippingFee * 2;
  const allergens = allergenLine(locale);
  const noticeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  // 고시 표 — 값이 없는 칸은 사유(고시 Ⅱ.3). 사용방법은 '사용법' 칸과 같은 글
  const noticeRows = productNoticeRows(noticeLocale);
  const usage = usageText(noticeLocale);

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

        <ProductShot
          src={PRODUCT_PHOTOS.main}
          alt={t("photoAlt")}
          soonLabel={t("photoSoon")}
          className="w-[max(40%,min(100%,320px))]"
          sizes="(max-width: 767px) 100vw, 40vw"
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
            {/* 상품정보제공 고시(화장품) — 값은 constants/product-notice 한 곳. 계약 전에 보여야 해서 펼친 채로, 다른 칸보다 먼저(고시 Ⅳ.1) */}
            <Detail title={t("notice.title")} isOpen>
              <dl className="m-0 pb-[18px]">
                {noticeRows.map((row) => (
                  <div
                    key={row.key}
                    className="grid gap-[2px] border-t border-line py-[10px] first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,11em)_1fr] sm:gap-[16px]"
                  >
                    <dt className="text-[13px] leading-[1.6] text-grey">
                      {t(`notice.${row.key}`)}
                    </dt>
                    <dd
                      className={`m-0 whitespace-pre-line text-[14px] leading-[1.7] ${row.isPending ? "text-grey" : "text-ink"}`}
                    >
                      {row.text}
                    </dd>
                  </div>
                ))}
              </dl>
            </Detail>
            {/* 사용법은 표시 문구가 확정될 때까지 메시지를 비워 두고 칸을 숨긴다(자리 표시 문구를 손님에게 보이지 않게) */}
            {usage && (
              <Detail title={t("howToUse")}>
                <p className={DETAIL_BODY}>{usage}</p>
              </Detail>
            )}
            {/* 전성분은 처방 표 한 곳(constants/ingredients)에서 — 한국어 화면은 한글 이름, 그 밖은 INCI.
                향료 속 알레르기 유발 성분은 긴 목록 끝에 묻히지 않게 바로 아래 따로 */}
            <Detail title={t("ingredients")}>
              <p className={DETAIL_BODY}>{ingredientLine(locale)}</p>
              <p className={`${DETAIL_BODY} text-ink`}>{t("allergens", { names: allergens })}</p>
            </Detail>
            {/* 배송·교환·환불 안내 2판의 요약. 금액은 주문서와 같은 상수에서 — 바뀌면 정책 문서(관리 툴)도 같이 */}
            <Detail title={t("shipping")}>
              <p className={DETAIL_BODY}>
                {t("shippingBody", {
                  fee: formatKRW(CHECKOUT_PRICING.shippingFee),
                  freeOver: formatKRW(CHECKOUT_PRICING.freeShippingOver),
                  // 무료 배송으로 받은 단순 변심 반품: 반품 편도 + 처음 배송비(환불 정책 v2)
                  roundTrip: formatKRW(roundTripFee),
                })}
              </p>
            </Detail>
          </div>
          {/* 접힌 배송·반품 안에 두지 않는다 — 펼치지 않아도 보여야 한다 */}
          <ReturnNotice className="-mt-[12px]" />
        </div>
      </div>
    </section>
  );
}

/** 접이 항목 본문 글 — 전성분처럼 긴 글도 읽히게 14px·넉넉한 줄 간격 */
const DETAIL_BODY = "m-0 pb-[18px] text-[14px] leading-[1.75] text-ink-soft";

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface DetailProps {
  title: string;
  children: React.ReactNode;
  /** 처음부터 펼친다(고시처럼 계약 전에 보여야 하는 것) */
  isOpen?: boolean;
}

function Detail({ title, children, isOpen = false }: DetailProps) {
  return (
    <details className="home-details border-b border-line" open={isOpen}>
      <summary className="flex items-center justify-between py-[16px] text-[14px]">
        {title}
        <span
          aria-hidden="true"
          className="home-details__icon text-[18px] leading-none text-grey transition-transform duration-300"
        >
          +
        </span>
      </summary>
      {children}
    </details>
  );
}

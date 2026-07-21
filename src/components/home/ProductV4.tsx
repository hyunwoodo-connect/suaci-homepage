/* eslint-disable @next/next/no-img-element */
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { HOME_V4_IMAGES } from "@/constants/homeImages";
import { DAILY_CALMING_MIST } from "@/data/products";

/**
 * Home v4 섹션 01 — 제품. 라벨 행 + 이미지/카피/스펙 + 풀폭 CTA(샵 PDP로).
 */
export default function ProductV4() {
  const t = useTranslations("v4.product");
  const tShop = useTranslations("shop");

  return (
    <>
      <div className="sec" id="product">
        <div className="sec__no">01</div>
        <div className="sec__ti">
          The <em>product</em>
        </div>
        <div className="sec__me">{t("secMeta")}</div>
      </div>

      <div className="cell pr-img">
        <span className="cell__tag cell__tag--tr" style={{ color: "var(--color-paper)" }}>
          IMG—02
        </span>
        <img src={HOME_V4_IMAGES.product} alt={t("imgAlt")} />
      </div>
      <div className="cell pr-txt">
        <span className="cell__tag">B/01</span>
        <h3>{t("headline")}</h3>
        <p>{t("body")}</p>
      </div>
      <div className="cell pr-spec">
        <div className="r">
          <span>{t("specFinishLabel")}</span>
          <b>{t("specFinish")}</b>
        </div>
        <div className="r">
          <span>{t("specUseLabel")}</span>
          <b>{t("specUse")}</b>
        </div>
        <div className="r">
          <span>{t("specVolumeLabel")}</span>
          <b>100 ml · 3.4 fl.oz</b>
        </div>
      </div>
      <div className="cell pr-cta">
        <Link href={`/products/${DAILY_CALMING_MIST.slug}`}>{tShop("view")} →</Link>
      </div>
    </>
  );
}

/* eslint-disable @next/next/no-img-element */
import { useTranslations } from "next-intl";
import { HOME_V4_IMAGES } from "@/constants/homeImages";

const MOMENTS = [
  { key: "m1", img: HOME_V4_IMAGES.desk, cap: "01 · Desk", cls: "mo1", txtCls: "a", n: "01 / DESK" },
  { key: "m2", img: HOME_V4_IMAGES.outdoor, cap: "02 · Outdoor", cls: "mo2", txtCls: "b", n: "02 / OUTDOOR" },
  { key: "m3", img: HOME_V4_IMAGES.detail, cap: "03 · Over makeup", cls: "mo3", txtCls: "c", n: "03 / DETAIL" },
] as const;

/**
 * Home v4 섹션 02 — 순간들. 정사각 이미지 3셀 + 캡션 텍스트 3셀.
 */
export default function MomentsV4() {
  const t = useTranslations("v4.moments");

  return (
    <>
      <div className="sec" id="moments">
        <div className="sec__no">02</div>
        <div className="sec__ti">
          Four <em>ordinary</em> moments
        </div>
        <div className="sec__me">{t("secMeta")}</div>
      </div>

      {MOMENTS.map((m) => (
        <div key={m.key} className={`cell mo ${m.cls}`}>
          <img src={m.img} alt={t(`${m.key}Title`)} />
          <span className="cap">{m.cap}</span>
        </div>
      ))}

      {MOMENTS.map((m) => (
        <div key={`${m.key}-txt`} className={`cell mo-txt ${m.txtCls}`}>
          <span className="n">{m.n}</span>
          <h4>{t(`${m.key}Title`)}</h4>
          <p>{t(`${m.key}Body`)}</p>
        </div>
      ))}
    </>
  );
}

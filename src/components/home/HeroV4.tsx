/* eslint-disable @next/next/no-img-element */
import { useTranslations } from "next-intl";
import { HOME_V4_IMAGES } from "@/constants/homeImages";

/**
 * Home v4 히어로 — 풀블리드 비주얼 셀 + 리드/메타/키 3분할 행.
 * 헤드라인·모노 라벨은 디자인 타이포 요소로 EN 고정.
 */
export default function HeroV4() {
  const t = useTranslations("v4.hero");

  return (
    <>
      <div className="cell hero-v">
        <img src={HOME_V4_IMAGES.hero} alt={t("heroAlt")} />
        <span className="kick">SUACI · Daily Portable Mist · 50ML · Fig.01</span>
        <span className="badge">
          <i />
          Film — 01
        </span>
        <h1>
          Stay <em>light.</em>
          <br />
          Carry calm.
        </h1>
      </div>

      <div className="cell hero-lead">
        <p>
          {t("leadPre")} <b>{t("leadStrong")}</b> {t("leadPost")}
        </p>
      </div>
      <div className="cell hero-meta">
        <span className="mono">{t("volumeLabel")}</span>
        <b>50 ml · 1.7 fl.oz</b>
        <span className="mono" style={{ marginTop: "8px" }}>
          {t("statusLabel")}
        </span>
        <b>{t("statusValue")}</b>
      </div>
      <div className="cell hero-key">
        <span className="cell__tag">A/03</span>
        <span className="key-line">{t("keyLine")}</span>
      </div>
    </>
  );
}

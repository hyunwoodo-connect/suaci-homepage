import { useTranslations } from "next-intl";

/**
 * v5 브랜드 스토리 — 작은 글씨, 넓은 여백.
 * 라벨(점+our story) / 헤드라인 / 본문 2줄 / "take ~~a break~~ suaci."
 */
export default function Story() {
  const t = useTranslations("home.story");

  return (
    <section
      id="story"
      aria-label={t("label")}
      className="w-full px-[16px] py-[clamp(96px,13vw,200px)] md:px-[48px]"
    >
      <div className="mx-auto flex max-w-[1344px] flex-wrap items-start justify-between gap-x-[48px] gap-y-[40px]">
        <p className="m-0 flex flex-[0_0_160px] items-center gap-[10px] text-[12px] text-grey">
          <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-lime" />
          {t("label")}
        </p>
        <div className="mr-auto flex flex-[0_1_560px] flex-col gap-[clamp(28px,3vw,44px)]">
          <h2 className="m-0 text-[clamp(20px,1.9vw,28px)] font-normal leading-[1.3] tracking-[-0.025em] [text-wrap:balance]">
            {t("headline")}
          </h2>
          <div className="flex max-w-[400px] flex-col gap-[14px] text-[14px] leading-[1.65] text-ink-soft">
            <p className="m-0">{t("body1")}</p>
            <p className="m-0">{t("body2")}</p>
          </div>
          <p className="m-0 text-[14px] font-medium text-ink">
            {t("take")}{" "}
            <s className="font-normal text-[#9a9a96] decoration-1">{t("aBreak")}</s>{" "}
            {t("suaci")}
          </p>
        </div>
      </div>
    </section>
  );
}

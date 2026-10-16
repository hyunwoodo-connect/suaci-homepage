import { useTranslations } from "next-intl";
import { HOME_MEDIA } from "@/constants/product";

/**
 * v5 히어로 — 풀블리드 룩북 루프 영상(무음·자동재생) + 하단 소문자 캡션.
 * 영상 로딩 전/저전력 모드에선 poster(같은 첫 프레임)가 보인다.
 */
export default function Hero() {
  const t = useTranslations("home.hero");

  return (
    <section
      aria-label="take suaci"
      className="relative w-full overflow-hidden bg-studio min-h-[clamp(600px,56.25vw,900px)]"
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={HOME_MEDIA.heroPoster}
        aria-label={t("videoLabel")}
        className="absolute inset-0 h-full w-full object-cover object-[62%_50%]"
      >
        <source src={HOME_MEDIA.heroWebm} type="video/webm" />
        <source src={HOME_MEDIA.heroMp4Small} type="video/mp4" media="(max-width: 767px)" />
        <source src={HOME_MEDIA.heroMp4} type="video/mp4" />
      </video>

      <div className="absolute inset-x-0 bottom-0 px-[16px] pb-[24px] md:px-[48px] md:pb-[40px]">
        <h1 className="m-0 flex flex-wrap items-baseline gap-x-[16px] gap-y-[4px] text-[clamp(22px,2.4vw,32px)] font-normal leading-[1.15] tracking-[-0.03em]">
          {t("title")}
          <span className="text-[13px] tracking-normal text-ink-soft">{t("product")}</span>
        </h1>
      </div>
    </section>
  );
}

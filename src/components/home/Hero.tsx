import { preload } from "react-dom";

import { useTranslations } from "next-intl";

import LoopVideo from "@/components/home/LoopVideo";
import { HOME_MEDIA } from "@/constants/product";

/** 폰 포스터를 쓰는 폭 — 잘라 둔 폰 포스터(1100×1440)가 높이 600 칸을 늘리지 않고 덮는 데까지(458px) */
const MOBILE_POSTER_MEDIA = "(max-width: 458px)";

/**
 * v5 히어로 — 풀블리드 룩북 루프 영상(무음·자동재생) + 하단 소문자 캡션.
 * 영상 로딩 전/저전력 모드에선 poster(같은 첫 프레임)가 보인다.
 */
export default function Hero() {
  const t = useTranslations("home.hero");
  // 첫 화면에서 가장 큰 그림이 포스터다 — HTML 을 읽자마자 화면 폭에 맞는 한 장만 받기 시작한다
  preload(HOME_MEDIA.heroPosterMobile, {
    as: "image",
    fetchPriority: "high",
    media: MOBILE_POSTER_MEDIA,
  });
  preload(HOME_MEDIA.heroPoster, {
    as: "image",
    fetchPriority: "high",
    media: "(min-width: 459px)",
  });

  return (
    <section
      aria-label="take suaci"
      className="relative w-full overflow-hidden bg-studio min-h-[clamp(600px,56.25vw,900px)]"
    >
      {/* 포스터는 영상 뒤 그림으로 — video poster 는 폭마다 다른 그림을 못 줘서 폰도 2560px 를 받는다.
          영상 첫 장면이 뜨면 그 위를 덮는다(같은 첫 프레임이라 바뀌는 게 안 보인다) */}
      <picture>
        <source media={MOBILE_POSTER_MEDIA} srcSet={HOME_MEDIA.heroPosterMobile} />
        <img
          src={HOME_MEDIA.heroPoster}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-[62%_50%] max-[458px]:object-center"
        />
      </picture>
      <LoopVideo
        webm={HOME_MEDIA.heroWebm}
        mp4={HOME_MEDIA.heroMp4}
        label={t("videoLabel")}
        className="absolute inset-0 h-full w-full object-cover object-[62%_50%]"
      />

      <div className="absolute inset-x-0 bottom-0 px-[16px] pb-[24px] md:px-[48px] md:pb-[40px]">
        {/* 헤더 로고·본문과 같은 최대 폭 — 넓은 화면에서도 캡션 왼쪽 선이 로고와 맞는다 */}
        <h1 className="m-0 mx-auto flex max-w-[1344px] flex-wrap items-baseline gap-x-[16px] gap-y-[4px] text-[clamp(22px,2.4vw,32px)] font-normal leading-[1.15] tracking-[-0.03em]">
          {t("title")}
          <span className="text-[13px] tracking-normal text-ink-soft">{t("product")}</span>
        </h1>
      </div>
    </section>
  );
}

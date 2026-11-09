import Image from "next/image";
import { useTranslations } from "next-intl";

import LoopVideo from "@/components/home/LoopVideo";
import ProductShot from "@/components/home/ProductShot";
import { HOME_MEDIA, PRODUCT_PHOTOS } from "@/constants/product";

/**
 * v5 무드 갤러리 — 완벽한 그리드가 아닌 엇갈린 배치.
 * 폭은 `max(데스크톱 %, min(100%, 모바일 최소 px))` 한 줄로 반응형 처리(미디어쿼리 없음).
 * 3번째 물결 컷은 뷰포트 풀블리드 루프 영상(body overflow-x hidden 전제).
 */
export default function Moments() {
  const t = useTranslations("home.moments");
  const tv = useTranslations("home.video");
  const waterVideoName = tv("water");

  return (
    <section
      id="moments"
      aria-label={t("label")}
      className="w-full overflow-hidden px-[clamp(16px,4vw,48px)] pb-[clamp(96px,12vw,180px)]"
    >
      <div className="mx-auto flex max-w-[1344px] flex-wrap items-start justify-between gap-x-[20px] gap-y-[clamp(40px,6vw,96px)]">
        <Shot
          src={HOME_MEDIA.chair}
          alt={t("chairAlt")}
          w={1100}
          h={1656}
          caption={t("chair")}
          className="w-[max(40%,min(100%,300px))]"
          sizes="(max-width: 767px) 92vw, 40vw"
        />
        <Shot
          src={HOME_MEDIA.earrings}
          alt={t("earringsAlt")}
          w={1300}
          h={1625}
          caption={t("earrings")}
          className="ml-auto mr-[4%] mt-[clamp(0px,14vw,220px)] w-[max(30%,min(100%,250px))]"
          sizes="(max-width: 767px) 70vw, 30vw"
        />
        <div className="relative ml-[calc(50%-50vw)] w-screen shrink-0">
          {/* 물결 루프 영상(첫·끝 프레임 동일, 무음). 로딩 전엔 poster(첫 프레임). */}
          <LoopVideo
            webm={HOME_MEDIA.waterWebm}
            mp4={HOME_MEDIA.waterMp4}
            poster={HOME_MEDIA.waterPoster}
            label={t("waterAlt")}
            className="aspect-[21/9] h-auto w-full bg-studio object-cover"
            toggleLabels={{
              pause: tv("pause", { name: waterVideoName }),
              play: tv("play", { name: waterVideoName }),
            }}
            toggleClassName="bottom-[4px] right-[4px] md:bottom-[16px] md:right-[16px]"
          />
        </div>
        <Shot
          src={HOME_MEDIA.turntable}
          alt={t("turntableAlt")}
          w={1100}
          h={1100}
          className="mt-[clamp(0px,6vw,96px)] w-[max(21%,min(100%,220px))]"
          sizes="(max-width: 767px) 60vw, 21vw"
        />
        {/* 제품이 나오는 컷은 실제 병 사진만(AI 시안 병은 실제 용기와 모양이 달랐다) — 오기 전엔 칸이 없다 */}
        <ProductShot
          src={PRODUCT_PHOTOS.moment}
          alt={t("bottleAlt")}
          className="ml-auto w-[max(25%,min(100%,260px))]"
          sizes="(max-width: 767px) 70vw, 25vw"
        />
        <Shot
          src={HOME_MEDIA.basket}
          alt={t("basketAlt")}
          w={1100}
          h={1473}
          className="mt-[clamp(0px,12vw,200px)] w-[max(21%,min(100%,220px))]"
          sizes="(max-width: 767px) 60vw, 21vw"
        />
        <Shot
          src={HOME_MEDIA.paper}
          alt={t("paperAlt")}
          w={1200}
          h={1200}
          caption={t("paper")}
          className="ml-auto mt-[clamp(0px,3vw,48px)] w-[max(27%,min(100%,260px))]"
          sizes="(max-width: 767px) 75vw, 27vw"
        />
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface ShotProps {
  src: string;
  alt: string;
  w: number;
  h: number;
  caption?: string;
  className: string;
  sizes: string;
}

function Shot({ src, alt, w, h, caption, className, sizes }: ShotProps) {
  return (
    <figure className={`m-0 ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={w}
        height={h}
        sizes={sizes}
        // 첫 화면 아래 사진 — 느린 망에선 lazy 범위가 넓어 바로 받기 시작한다. 히어로 포스터보다 뒤로
        fetchPriority="low"
        className="h-auto w-full bg-studio"
      />
      {caption && <figcaption className="mt-[12px] text-[13px] text-grey">{caption}</figcaption>}
    </figure>
  );
}

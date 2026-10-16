import Image from "next/image";
import { useTranslations } from "next-intl";
import { HOME_MEDIA } from "@/constants/product";

/**
 * v5 무드 갤러리 — 완벽한 그리드가 아닌 엇갈린 배치.
 * 폭은 `max(데스크톱 %, min(100%, 모바일 최소 px))` 한 줄로 반응형 처리(미디어쿼리 없음).
 * 3번째 물결 컷은 뷰포트 풀블리드(body overflow-x hidden 전제).
 */
export default function Moments() {
  const t = useTranslations("home.moments");

  return (
    <section
      id="moments"
      aria-label={t("label")}
      className="w-full overflow-hidden px-[clamp(16px,4vw,48px)] pb-[clamp(96px,12vw,180px)]"
    >
      <div className="mx-auto flex max-w-[1344px] flex-wrap items-start justify-between gap-x-[20px] gap-y-[clamp(40px,6vw,96px)]">
        <Shot
          src={HOME_MEDIA.sofa}
          alt={t("sofaAlt")}
          w={1400}
          h={1750}
          caption={t("sofa")}
          className="w-[max(44%,min(100%,300px))]"
          sizes="(max-width: 767px) 92vw, 44vw"
        />
        <Shot
          src={HOME_MEDIA.paper}
          alt={t("paperAlt")}
          w={1200}
          h={1200}
          caption={t("paper")}
          className="ml-auto mr-[4%] mt-[clamp(0px,16vw,260px)] w-[max(28%,min(100%,230px))]"
          sizes="(max-width: 767px) 70vw, 28vw"
        />
        <div className="ml-[calc(50%-50vw)] w-screen">
          <Image
            src={HOME_MEDIA.water}
            alt={t("waterAlt")}
            width={2048}
            height={1360}
            sizes="100vw"
            className="aspect-[21/9] h-auto w-full object-cover"
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
        <Shot
          src={HOME_MEDIA.bottle}
          alt={t("bottleAlt")}
          w={1200}
          h={1500}
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
          src={HOME_MEDIA.earrings}
          alt={t("earringsAlt")}
          w={1300}
          h={1625}
          className="ml-auto mt-[clamp(0px,3vw,48px)] w-[max(27%,min(100%,280px))]"
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
      <Image src={src} alt={alt} width={w} height={h} sizes={sizes} className="h-auto w-full bg-studio" />
      {caption && <figcaption className="mt-[12px] text-[13px] text-grey">{caption}</figcaption>}
    </figure>
  );
}

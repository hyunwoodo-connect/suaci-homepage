import Image from "next/image";
import { SECTION_PADDING_Y, SHELL } from "@/constants/site";

/**
 * Lifestyle — 비대칭 이미지 그리드.
 *
 * 좌측 큰 mood 1장 + 우측 stacked 2장. 캡션은 작은 영문 한 줄만.
 * 카피 없음, 이미지가 분위기를 만든다.
 */

interface LifestyleImage {
  src: string;
  alt: string;
  caption: string;
}

const LEFT: LifestyleImage = {
  src: "/image/mood/mood-03.jpg",
  alt: "호숫가 잔디 위에 앉아 있는 평온한 오후",
  caption: "Quietly outside.",
};

const RIGHT: readonly LifestyleImage[] = [
  {
    src: "/image/daily/daily-03.jpg",
    alt: "햇살이 들어오는 공간, 책상 앞의 일상",
    caption: "At the desk.",
  },
  {
    src: "/image/usage/usage-02.jpg",
    alt: "햇살 아래 미스트를 가볍게 분사하는 손",
    caption: "A breath of mist.",
  },
];

export default function LifestyleSection() {
  return (
    <section
      id="story"
      className={`lifestyle ${SECTION_PADDING_Y} border-t border-line bg-background`}
    >
      <div className={SHELL}>
        <div className="mb-[56px] flex items-baseline justify-between gap-[24px] max-md:flex-col max-md:items-start max-md:gap-[14px] max-md:mb-[28px]">
          <div className="font-en text-[11px] tracking-[0.22em] uppercase text-green flex gap-[10px] items-baseline">
            <span className="num text-ink-mute tracking-[0.18em]">No.03</span>
            <span className="inline-block w-[18px] h-px bg-green -translate-y-[3px]" />
            <span>In the air</span>
          </div>
          <h2 className="font-fraunces italic font-light text-[clamp(20px,2vw,26px)] leading-[1.4] tracking-[-0.005em] text-ink-soft max-w-[28ch] m-0 text-right max-md:text-left">
            Daily moments held in mist.
          </h2>
        </div>

        <div className="grid grid-cols-[1.25fr_1fr] gap-[16px] max-md:grid-cols-1">
          <LifestyleTile image={LEFT} tall />
          <div className="grid grid-rows-2 gap-[16px] max-md:grid-rows-none">
            {RIGHT.map((img) => (
              <LifestyleTile key={img.src} image={img} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface LifestyleTileProps {
  image: LifestyleImage;
  tall?: boolean;
}

function LifestyleTile({ image, tall }: LifestyleTileProps) {
  const aspect = tall ? "aspect-[3/4]" : "aspect-[5/4]";

  return (
    <figure
      className={`reveal relative ${aspect} bg-bg-warm overflow-hidden m-0 group max-md:aspect-[4/3]`}
    >
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes={tall ? "(max-width: 768px) 100vw, 55vw" : "(max-width: 768px) 100vw, 40vw"}
        className="object-cover transition-transform duration-[1.4s] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.025]"
      />
      <figcaption className="absolute left-[12px] bottom-[12px] font-en text-[10px] tracking-[0.18em] uppercase text-white bg-[rgba(15,61,46,0.85)] px-[8px] py-[3px]">
        {image.caption}
      </figcaption>
    </figure>
  );
}

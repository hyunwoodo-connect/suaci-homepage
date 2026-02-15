import { useTranslations } from "next-intl";
import { SECTION_PADDING_X } from "@/constants/site";

/**
 * 브랜드 스토리 섹션
 *
 * 레이아웃: 영상(좌) + 브랜드 탄생 스토리(우) 2컬럼
 * 왜 이 브랜드를 시작하게 되었는지에 대한 내러티브
 */
export default function BrandStorySection() {
  const t = useTranslations("brandStory");

  // title에 \n이 포함되어 있으므로 <br />로 변환
  const titleParts = t("title").split("\n");

  return (
    <section className="py-20 md:py-32">
      <div className={`max-w-[1400px] mx-auto ${SECTION_PADDING_X}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 lg:gap-20 items-center">
          {/* 좌측 — 영상 */}
          <div className="relative aspect-[3/4] bg-black overflow-hidden">
            <video
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src="/brand-story.mp4" type="video/mp4" />
            </video>
          </div>

          {/* 우측 — 스토리 */}
          <div>
            <p className="text-[10px] sm:text-xs tracking-[0.2em] text-muted mb-4">
              {t("subtitle")}
            </p>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-[-0.02em] leading-[1.2] mb-8">
              {titleParts.map((part, i) => (
                <span key={i}>
                  {part}
                  {i < titleParts.length - 1 && <br />}
                </span>
              ))}
            </h2>

            <div className="w-10 h-[1px] bg-border mb-8" />

            <div className="flex flex-col gap-5 text-sm sm:text-base text-muted leading-[1.8] tracking-[-0.01em]">
              <p>{t("p1")}</p>
              <p>{t("p2")}</p>
              <p>{t("p3")}</p>
              <p className="text-foreground font-semibold">{t("p4")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

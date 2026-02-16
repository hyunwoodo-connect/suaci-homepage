import Image from "next/image";
import { useTranslations } from "next-intl";
import { SECTION_PADDING_X } from "@/constants/site";

const LIFESTYLE_IMAGES = [
  "/lifestyle/1.jpeg",
  "/lifestyle/2.jpeg",
  "/lifestyle/3.jpeg",
  "/lifestyle/4.jpeg",
  "/lifestyle/5.jpeg",
  "/lifestyle/6.jpeg",
  "/lifestyle/7.jpeg",
  "/lifestyle/8.jpeg",
  "/lifestyle/9.jpeg",
  "/lifestyle/10.jpeg",
  "/lifestyle/11.jpeg",
];

/**
 * 라이프스타일 섹션
 *
 * 정사각형 셀의 균일한 포토 그리드
 * 텍스트는 최소화, 비주얼 중심
 */
export default function LifestyleSection() {
  const t = useTranslations("lifestyle");

  return (
    <section className="py-16 md:py-24">
      <div className={`max-w-[1400px] mx-auto ${SECTION_PADDING_X}`}>
        {/* 헤더 — 미니멀 */}
        <div className="mb-10 md:mb-14">
          <p className="text-[10px] sm:text-xs tracking-[0.2em] text-foreground/40 mb-3">
            {t("subtitle")}
          </p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-[-0.02em] leading-[1.2]">
            {t("title")}
          </h2>
        </div>

        {/* 정사각형 포토 그리드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-3">
          {LIFESTYLE_IMAGES.map((src, i) => (
            <div
              key={src}
              className="relative aspect-square overflow-hidden group"
            >
              <Image
                src={src}
                alt={`SUACI lifestyle ${i + 1}`}
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * Moment Stack — 두 장의 사용 사진 나란히 배치.
 *
 * 왼쪽 사진은 데스크탑에서 -100px 위로 오프셋.
 * 각 사진에 figcaption 스탬프 (green bg).
 */
export default function MomentStackSection() {
  const t = useTranslations("momentStack");

  return (
    <section className="relative bg-background pt-[120px] max-sm:pt-[72px]">
      <div className="max-w-[1480px] mx-auto px-[18px] md:px-[32px] grid grid-cols-2 gap-[24px] items-end max-lg:grid-cols-1">
        {/* Figure A — offset upward on desktop */}
        <figure className="relative m-0 overflow-hidden bg-beige aspect-[4/5] -translate-y-[100px] max-lg:translate-y-0">
          <Image
            src="/image/usage/usage-02.jpg"
            alt="햇빛 속에 미스트가 흩어지는 순간"
            fill
            sizes="(max-width: 1100px) 100vw, 50vw"
            className="object-cover"
          />
          <figcaption className="absolute left-[18px] bottom-[18px] font-en text-[10px] tracking-[0.32em] uppercase text-white bg-[rgba(15,61,46,0.86)] px-[14px] py-[8px]">
            {t("captionA")}
          </figcaption>
        </figure>

        {/* Figure B */}
        <figure className="relative m-0 overflow-hidden bg-beige aspect-[5/6]">
          <Image
            src="/image/usage/usage-03.jpg"
            alt="얼굴에 닿기 전의 가벼운 분사"
            fill
            sizes="(max-width: 1100px) 100vw, 50vw"
            className="object-cover"
          />
          <figcaption className="absolute left-[18px] bottom-[18px] font-en text-[10px] tracking-[0.32em] uppercase text-white bg-[rgba(15,61,46,0.86)] px-[14px] py-[8px]">
            {t("captionB")}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

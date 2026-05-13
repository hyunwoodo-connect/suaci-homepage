import Image from "next/image";
import { SECTION_PADDING_Y_LG, SHELL } from "@/constants/site";

/**
 * Lifestyle — 수직 포토 에세이.
 *
 * 큰 사진 한 장 → 시적 풀라인 → 비대칭 2 사진 → 마지막 라인.
 * 매거진 스프레드처럼 호흡을 둔다. 카피는 거의 없음.
 */
export default function LifestyleSection() {
  return (
    <section
      id="story"
      className={`lifestyle ${SECTION_PADDING_Y_LG} border-t border-line bg-background overflow-hidden`}
    >
      <div className={SHELL}>
        {/* Eyebrow + opening pull */}
        <div className="grid grid-cols-[160px_1fr] gap-[48px] items-baseline mb-[80px] max-md:grid-cols-1 max-md:gap-[18px] max-md:mb-[40px]">
          <span className="font-en text-[11px] tracking-[0.22em] uppercase text-green flex gap-[10px] items-baseline">
            <span className="num text-ink-mute tracking-[0.18em]">No.03</span>
            <span className="inline-block w-[18px] h-px bg-green -translate-y-[3px]" />
            <span>In the air</span>
          </span>
          <h2 className="font-serif font-light text-[clamp(34px,4vw,56px)] leading-[1.18] tracking-[-0.02em] text-ink text-balance max-w-[20ch] m-0 max-md:text-[28px]">
            Daily moments,{" "}
            <span className="font-fraunces italic text-green">held in mist.</span>
          </h2>
        </div>

        {/* Image 1 — full-bleed tall mood (호숫가) */}
        <figure className="reveal-mask relative aspect-[16/10] m-0 bg-bg-warm overflow-hidden max-md:aspect-[4/5]">
          <Image
            src="/image/mood/mood-03.jpg"
            alt="호숫가 잔디 위에 앉아 카메라를 들고 있는 평온한 오후"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <figcaption className="absolute left-[18px] bottom-[18px] font-en text-[10px] tracking-[0.22em] uppercase text-white bg-[rgba(15,61,46,0.85)] px-[10px] py-[4px]">
            Field — Outdoor / quiet hour
          </figcaption>
        </figure>

        {/* Pull quote 1 */}
        <div className="reveal grid grid-cols-[200px_1fr_200px] items-start gap-[24px] pt-[80px] pb-[80px] max-md:grid-cols-1 max-md:pt-[40px] max-md:pb-[40px]">
          <span className="font-en text-[11px] tracking-[0.22em] uppercase text-green pt-[14px]">
            — Closing
          </span>
          <p className="font-serif font-light text-[clamp(22px,2.4vw,32px)] leading-[1.5] tracking-[-0.012em] text-ink text-balance m-0 max-w-[28ch] justify-self-start max-md:text-[20px]">
            바람과 햇빛, 잠깐의 긴장 사이로,{" "}
            <span className="font-fraunces italic text-green">한 번의 분사.</span>
          </p>
          <span className="font-en text-[11px] tracking-[0.22em] uppercase text-ink-mute text-right max-md:hidden">
            No.03 · Field
          </span>
        </div>

        {/* Image 2 + 3 — asymmetric 2-up */}
        <div className="grid grid-cols-[1fr_1.3fr] gap-[24px] items-stretch max-md:grid-cols-1">
          <figure className="reveal-mask relative aspect-[4/5] m-0 bg-bg-warm overflow-hidden max-md:aspect-[4/3]">
            <Image
              src="/image/daily/daily-03.jpg"
              alt="햇살이 들어오는 공간, 책상 앞의 차분한 일상"
              fill
              sizes="(max-width: 768px) 100vw, 42vw"
              className="object-cover"
            />
            <figcaption className="absolute left-[14px] bottom-[14px] font-en text-[10px] tracking-[0.22em] uppercase text-white bg-[rgba(15,61,46,0.85)] px-[10px] py-[4px]">
              Indoor — desk / morning
            </figcaption>
          </figure>

          <figure className="reveal-mask relative aspect-[5/6] m-0 bg-bg-warm overflow-hidden max-md:aspect-[4/3]">
            <Image
              src="/image/usage/usage-02.jpg"
              alt="햇살 아래 미스트를 가볍게 분사하는 손과 흩날리는 물방울"
              fill
              sizes="(max-width: 768px) 100vw, 56vw"
              className="object-cover"
            />
            <figcaption className="absolute left-[14px] bottom-[14px] font-en text-[10px] tracking-[0.22em] uppercase text-white bg-[rgba(15,61,46,0.85)] px-[10px] py-[4px]">
              Use — A breath of mist
            </figcaption>
          </figure>
        </div>

        {/* Closing dotted rule */}
        <div className="reveal mt-[120px] pt-[24px] border-t border-dotted border-line flex justify-between gap-[24px] font-en text-[10px] tracking-[0.22em] uppercase text-ink-mute max-md:mt-[64px] max-md:flex-col max-md:gap-[10px]">
          <span>— suaci · field journal</span>
          <span className="font-fraunces italic normal-case tracking-normal text-[14px] text-ink-soft">
            held lightly, every day.
          </span>
          <span className="text-right">No.03 · 2026</span>
        </div>
      </div>
    </section>
  );
}

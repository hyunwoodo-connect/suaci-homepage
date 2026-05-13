import Image from "next/image";

/**
 * Lifestyle — 수직 포토 에세이.
 *
 * 큰 사진 한 장 → 이태릭 풀라인 → 비대칭 2-up.
 * 캡션·코너 라벨·매거진 장식 다 제거. 사진과 호흡만.
 */
export default function LifestyleSection() {
  return (
    <section id="story" className="lifestyle relative bg-background py-[200px] max-md:py-[120px]">
      <div className="mx-auto max-w-[1480px] px-[28px] max-md:px-[18px]">
        <div className="mb-[120px] text-center max-md:mb-[64px]">
          <span className="font-en text-[10px] tracking-[0.36em] uppercase text-ink-mute">
            — In the air
          </span>
          <h2 className="mt-[28px] font-serif font-light text-[clamp(32px,3.6vw,52px)] leading-[1.25] tracking-[-0.015em] text-ink m-0 max-w-[20ch] mx-auto text-balance max-md:text-[28px]">
            Daily moments,{" "}
            <span className="font-fraunces italic text-green">
              held in mist.
            </span>
          </h2>
        </div>

        <figure className="relative aspect-[16/9] m-0 bg-bg-warm overflow-hidden max-md:aspect-[4/5]">
          <Image
            src="/image/mood/mood-03.jpg"
            alt="호숫가 잔디 위에 앉아 있는 평온한 오후"
            fill
            sizes="100vw"
            className="object-cover"
          />
        </figure>

        <div className="flex justify-center py-[140px] max-md:py-[72px]">
          <p className="font-fraunces italic font-light text-[clamp(22px,2.4vw,32px)] leading-[1.5] tracking-[-0.012em] text-ink-soft text-center max-w-[34ch] m-0 max-md:text-[20px]">
            바람과 햇빛, 잠깐의 긴장 사이로,
            <br />
            <span className="text-green">한 번의 분사.</span>
          </p>
        </div>

        <div className="grid grid-cols-[1fr_1.4fr] gap-[24px] items-stretch max-md:grid-cols-1 max-md:gap-[18px]">
          <figure className="relative aspect-[4/5] m-0 bg-bg-warm overflow-hidden">
            <Image
              src="/image/daily/daily-03.jpg"
              alt="햇살이 들어오는 공간, 책상 앞의 차분한 일상"
              fill
              sizes="(max-width: 768px) 100vw, 42vw"
              className="object-cover"
            />
          </figure>
          <figure className="relative aspect-[5/6] m-0 bg-bg-warm overflow-hidden">
            <Image
              src="/image/usage/usage-02.jpg"
              alt="햇살 아래 미스트를 가볍게 분사하는 손과 흩날리는 물방울"
              fill
              sizes="(max-width: 768px) 100vw, 56vw"
              className="object-cover"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}

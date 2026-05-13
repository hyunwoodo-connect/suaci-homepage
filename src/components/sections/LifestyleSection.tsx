import Image from "next/image";

/**
 * Lifestyle — 풀 매거진 스프레드.
 *
 * 4개 블록 (Outdoor mood / Indoor daily / The moment usage / Studio product).
 * 각 블록 사이에 italic 풀라인이 호흡을 만든다.
 * 캡션·코너 라벨 거의 없음. 사진과 분량이 매거진을 만든다.
 */

const SECTION_LABEL_CLASS =
  "block mb-[40px] font-en text-[10px] tracking-[0.36em] uppercase text-ink-mute max-md:mb-[24px]";

const FIG_BASE =
  "relative m-0 bg-bg-warm overflow-hidden";

export default function LifestyleSection() {
  return (
    <section
      id="story"
      className="lifestyle relative bg-background py-[160px] max-md:py-[88px]"
    >
      <div className="mx-auto max-w-[1480px] px-[28px] max-md:px-[18px]">
        {/* Opening header */}
        <header className="mb-[140px] text-center max-md:mb-[72px]">
          <span className="font-en text-[10px] tracking-[0.36em] uppercase text-ink-mute">
            — In the air
          </span>
          <h2 className="mt-[28px] font-serif font-light text-[clamp(34px,3.8vw,56px)] leading-[1.25] tracking-[-0.015em] text-ink m-0 max-w-[22ch] mx-auto text-balance max-md:text-[30px]">
            Daily moments,{" "}
            <span className="font-fraunces italic text-green">held in mist.</span>
          </h2>
        </header>

        {/* ── Block 1: Outdoor (mood-04~08) ───────────────────────── */}
        <div className="mb-[120px] max-md:mb-[72px]">
          <span className={SECTION_LABEL_CLASS}>No.01 — Outdoor</span>

          <div className="grid grid-cols-[1.6fr_1fr] gap-[18px] max-md:grid-cols-1">
            <figure className={`${FIG_BASE} aspect-[16/11] max-md:aspect-[4/3]`}>
              <Image
                src="/image/mood/mood-04.jpg"
                alt="잔디 위에 누운 평온한 한낮의 무드"
                fill
                sizes="(max-width: 768px) 100vw, 56vw"
                className="object-cover"
              />
            </figure>
            <figure className={`${FIG_BASE} aspect-[3/4]`}>
              <Image
                src="/image/mood/mood-05.jpg"
                alt="햇볕 가득한 정원 의자에서 책 읽는 오후"
                fill
                sizes="(max-width: 768px) 100vw, 36vw"
                className="object-cover"
              />
            </figure>
          </div>

          <div className="mt-[18px] grid grid-cols-3 gap-[18px] max-md:grid-cols-2 max-md:gap-[14px]">
            <figure className={`${FIG_BASE} aspect-square`}>
              <Image
                src="/image/mood/mood-06.jpg"
                alt="자연광이 들어오는 무드 컷"
                fill
                sizes="(max-width: 768px) 50vw, 30vw"
                className="object-cover"
              />
            </figure>
            <figure className={`${FIG_BASE} aspect-square`}>
              <Image
                src="/image/mood/mood-07.jpg"
                alt="잔잔한 풍경의 한 장면"
                fill
                sizes="(max-width: 768px) 50vw, 30vw"
                className="object-cover"
              />
            </figure>
            <figure className={`${FIG_BASE} aspect-square max-md:col-span-2`}>
              <Image
                src="/image/mood/mood-08.jpg"
                alt="고요한 시간의 분위기 컷"
                fill
                sizes="(max-width: 768px) 100vw, 30vw"
                className="object-cover"
              />
            </figure>
          </div>
        </div>

        {/* Pull 1 */}
        <Pull text="흔들리는 순간에도," highlight="스스로의 호흡으로." />

        {/* ── Block 2: Indoor (daily-01~07) ───────────────────────── */}
        <div className="mb-[120px] max-md:mb-[72px]">
          <span className={SECTION_LABEL_CLASS}>No.02 — Indoor</span>

          <div className="grid grid-cols-[1fr_1.5fr] gap-[18px] max-md:grid-cols-1">
            <figure className={`${FIG_BASE} aspect-[3/4]`}>
              <Image
                src="/image/daily/daily-01.jpg"
                alt="도시의 거리, 일상의 한 컷"
                fill
                sizes="(max-width: 768px) 100vw, 36vw"
                className="object-cover"
              />
            </figure>
            <div className="grid grid-rows-2 gap-[18px]">
              <figure className={`${FIG_BASE} aspect-[16/9] max-md:aspect-[4/3]`}>
                <Image
                  src="/image/daily/daily-02.jpg"
                  alt="햇살이 들어오는 실내의 평온"
                  fill
                  sizes="(max-width: 768px) 100vw, 56vw"
                  className="object-cover"
                />
              </figure>
              <figure className={`${FIG_BASE} aspect-[16/9] max-md:aspect-[4/3]`}>
                <Image
                  src="/image/daily/daily-03.jpg"
                  alt="책상 앞, 차분한 작업의 시간"
                  fill
                  sizes="(max-width: 768px) 100vw, 56vw"
                  className="object-cover"
                />
              </figure>
            </div>
          </div>

          <div className="mt-[18px] grid grid-cols-4 gap-[18px] max-md:grid-cols-2 max-md:gap-[14px]">
            <figure className={`${FIG_BASE} aspect-[4/5]`}>
              <Image
                src="/image/daily/daily-04.jpg"
                alt="일상의 작은 디테일 1"
                fill
                sizes="(max-width: 768px) 50vw, 22vw"
                className="object-cover"
              />
            </figure>
            <figure className={`${FIG_BASE} aspect-[4/5]`}>
              <Image
                src="/image/daily/daily-05.jpg"
                alt="일상의 작은 디테일 2"
                fill
                sizes="(max-width: 768px) 50vw, 22vw"
                className="object-cover"
              />
            </figure>
            <figure className={`${FIG_BASE} aspect-[4/5]`}>
              <Image
                src="/image/daily/daily-06.jpg"
                alt="일상의 작은 디테일 3"
                fill
                sizes="(max-width: 768px) 50vw, 22vw"
                className="object-cover"
              />
            </figure>
            <figure className={`${FIG_BASE} aspect-[4/5]`}>
              <Image
                src="/image/daily/daily-07.jpg"
                alt="일상의 작은 디테일 4"
                fill
                sizes="(max-width: 768px) 50vw, 22vw"
                className="object-cover"
              />
            </figure>
          </div>
        </div>

        {/* Pull 2 */}
        <Pull text="바람과 햇빛, 잠깐의 긴장 사이로," highlight="한 번의 분사." />

        {/* ── Block 3: The Moment (usage-01~03) ───────────────────── */}
        <div className="mb-[120px] max-md:mb-[72px]">
          <span className={SECTION_LABEL_CLASS}>No.03 — The moment</span>

          <figure className={`${FIG_BASE} aspect-[16/10] max-md:aspect-[4/5]`}>
            <Image
              src="/image/usage/usage-01.jpg"
              alt="햇살 아래 미스트를 가볍게 분사하는 순간"
              fill
              sizes="100vw"
              className="object-cover"
            />
          </figure>

          <div className="mt-[18px] grid grid-cols-2 gap-[18px] max-md:grid-cols-1">
            <figure className={`${FIG_BASE} aspect-[5/6] max-md:aspect-[4/3]`}>
              <Image
                src="/image/usage/usage-02.jpg"
                alt="햇빛 속에서 미스트가 흩어지는 순간"
                fill
                sizes="(max-width: 768px) 100vw, 48vw"
                className="object-cover"
              />
            </figure>
            <figure className={`${FIG_BASE} aspect-[5/6] max-md:aspect-[4/3]`}>
              <Image
                src="/image/usage/usage-03.jpg"
                alt="얼굴에 닿기 전의 가벼운 분사"
                fill
                sizes="(max-width: 768px) 100vw, 48vw"
                className="object-cover"
              />
            </figure>
          </div>
        </div>

        {/* Pull 3 */}
        <Pull
          text="우리는 모든 걸 약속하지 않는다."
          highlight="덜 무너지게 할 뿐."
        />

        {/* ── Block 4: Studio (product-01~09) ─────────────────────── */}
        <div className="max-md:mb-[24px]">
          <div className="flex items-baseline justify-between mb-[40px] max-md:flex-col max-md:items-start max-md:gap-[10px] max-md:mb-[24px]">
            <span className="font-en text-[10px] tracking-[0.36em] uppercase text-ink-mute">
              No.04 — Studio
            </span>
            <span className="font-en text-[10px] tracking-[0.22em] uppercase text-ink-mute">
              Visual references
            </span>
          </div>

          <div className="grid grid-cols-3 gap-[14px] max-md:grid-cols-2 max-md:gap-[10px]">
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
              const num = String(n).padStart(2, "0");
              return (
                <figure
                  key={n}
                  className={`${FIG_BASE} aspect-square`}
                >
                  <Image
                    src={`/image/product/product-${num}.jpg`}
                    alt={`Studio reference ${num}`}
                    fill
                    sizes="(max-width: 768px) 50vw, 30vw"
                    className="object-cover"
                  />
                </figure>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface PullProps {
  text: string;
  highlight: string;
}

function Pull({ text, highlight }: PullProps) {
  return (
    <div className="my-[120px] flex justify-center max-md:my-[64px]">
      <p className="font-fraunces italic font-light text-[clamp(22px,2.4vw,32px)] leading-[1.5] tracking-[-0.012em] text-ink-soft text-center max-w-[36ch] m-0 max-md:text-[20px]">
        {text}
        <br />
        <span className="text-green">{highlight}</span>
      </p>
    </div>
  );
}

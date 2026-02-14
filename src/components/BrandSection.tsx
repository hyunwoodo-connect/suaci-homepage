import Link from "next/link";

export default function BrandSection() {
  return (
    <section className="relative py-24 md:py-40 bg-foreground text-white overflow-hidden">
      {/* Background decorative text */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[15vw] font-bold tracking-[0.2em] text-white/[0.03] select-none whitespace-nowrap pointer-events-none">
        SUACI
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
          {/* Left - Image Placeholder */}
          <div className="aspect-[4/5] bg-white/5 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs tracking-[0.3em] text-white/20">
                BRAND IMAGE
              </span>
            </div>
            {/* Decorative border */}
            <div className="absolute -top-3 -left-3 w-20 h-20 border-t border-l border-white/20" />
            <div className="absolute -bottom-3 -right-3 w-20 h-20 border-b border-r border-white/20" />
          </div>

          {/* Right - Content */}
          <div>
            <p className="text-xs tracking-[0.3em] text-white/40 mb-4">
              BRAND STORY
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-[1.2] tracking-tight mb-6">
              Our Story,<br />
              Our Identity
            </h2>
            <div className="w-10 h-[1px] bg-white/30 mb-6" />
            <p className="text-sm md:text-base text-white/50 leading-relaxed mb-4">
              SUACI는 진정성 있는 가치를 추구합니다.
              일상 속에서 자신만의 감성을 표현할 수 있도록,
              디테일 하나하나에 의미를 담았습니다.
            </p>
            <p className="text-sm md:text-base text-white/50 leading-relaxed mb-10">
              트렌드를 따르기보다, 시간이 지나도 변하지 않는
              본질적인 아름다움을 만들어갑니다.
            </p>
            <Link
              href="#"
              className="inline-flex items-center gap-3 text-sm tracking-[0.2em] text-white border border-white/30 px-8 py-4 hover:bg-white hover:text-foreground transition-all duration-500"
            >
              READ MORE
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

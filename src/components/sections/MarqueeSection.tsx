"use client";

import { useTranslations } from "next-intl";

/**
 * Marquee — 짙은 초록 배경 무한 수평 스크롤 텍스트.
 *
 * Fraunces italic, 점 구분자, 2x 복제로 seamless loop.
 */
export default function MarqueeSection() {
  const t = useTranslations("marquee");

  const texts = [t("t1"), t("t2"), t("t3"), t("t4")];

  return (
    <section className="bg-green text-cream-on-green overflow-hidden border-t border-white/5 border-b border-b-white/5 py-[30px]">
      <div className="flex gap-[64px] [animation:marquee_28s_linear_infinite] whitespace-nowrap will-change-transform">
        <MarqueeContent texts={texts} />
        <MarqueeContent texts={texts} />
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface MarqueeContentProps {
  texts: string[];
}

function MarqueeContent({ texts }: MarqueeContentProps) {
  return (
    <span className="font-fraunces italic font-light text-[48px] tracking-[-0.01em] leading-none max-sm:text-[32px]">
      {texts.map((text, i) => (
        <span key={i}>
          {text}
          <span className="inline-block w-[10px] h-[10px] rounded-full bg-cream-on-green mx-[36px] align-middle -translate-y-[6px]" />
        </span>
      ))}
    </span>
  );
}

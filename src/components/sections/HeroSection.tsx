import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SECTION_PADDING_X } from "@/constants/site";

/**
 * 히어로 섹션
 *
 * 풀스크린 비디오 위에 좌측 하단 겹침:
 * 로고 이미지 (풀 와이드)
 */
export default function HeroSection() {
  const t = useTranslations("hero");

  return (
    <section className="relative w-full h-screen overflow-hidden">
      {/* 배경 비디오 */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/home-video.mp4" type="video/mp4" />
      </video>

      {/* 오버레이 — 하단 그라디언트만 (영상 자체를 최대한 살림) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

      {/* 로고 + CTA — 좌측 하단 */}
      <div className={`relative z-10 h-full flex flex-col justify-end ${SECTION_PADDING_X} pb-6 sm:pb-8 md:pb-10`}>
        <Image
          src="/logo.png"
          alt={t("logoAlt")}
          width={1920}
          height={400}
          priority
          className="w-full h-auto object-contain brightness-0 invert opacity-90"
        />

        {/* 피부 진단 바로가기 */}
        <Link
          href="/skin-check"
          className="mt-5 flex w-fit items-center gap-2 rounded-full border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20"
        >
          <span className="text-base">🎨</span>
          내 퍼스널 컬러 알아보기
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

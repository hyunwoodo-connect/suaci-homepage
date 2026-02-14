import Image from "next/image";
import { SITE, SECTION_PADDING_X } from "@/constants/site";

/**
 * 히어로 섹션
 *
 * 풀스크린 비디오 위에 좌측 하단 겹침 (위→아래 순서):
 * 1) 타이틀
 * 2) 설명
 * 3) 로고 이미지 (풀 와이드)
 */
export default function HeroSection() {
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

      {/* 로고만 — 좌측 하단 */}
      <div className={`relative z-10 h-full flex flex-col justify-end ${SECTION_PADDING_X} pb-6 sm:pb-8 md:pb-10`}>
        <Image
          src="/logo.png"
          alt={SITE.name}
          width={1920}
          height={400}
          priority
          className="w-full h-auto object-contain brightness-0 invert opacity-90"
        />
      </div>
    </section>
  );
}

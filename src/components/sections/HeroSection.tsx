import Image from "next/image";
import { SITE } from "@/constants/site";

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

      {/* 콘텐츠 — 좌측 하단: 타이틀 → 설명 → 로고 */}
      <div className="relative z-10 h-full flex flex-col justify-end px-8 sm:px-10 md:px-14 lg:px-20 xl:px-28 pb-10 sm:pb-14 md:pb-16">
        {/* 타이틀 */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-snug tracking-tight text-white mb-3 md:mb-5">
          활동이 끝난 그 순간,<br />
          피부의 리커버리가 시작됩니다
        </h1>

        {/* 설명 */}
        <p className="text-sm sm:text-base text-white/70 leading-relaxed max-w-xl mb-8 md:mb-10">
          아웃도어 직후 발생하는 열감, 자극, 수분 손실.
          SUACI는 그 즉시 회복의 첫 단계를 위해 만들어졌습니다.
        </p>

        {/* 로고 이미지 — 풀 와이드 */}
        <Image
          src="/logo.png"
          alt={SITE.name}
          width={1200}
          height={300}
          priority
          className="w-full max-w-[900px] lg:max-w-[1100px] xl:max-w-[1300px] h-auto object-contain brightness-0 invert opacity-90"
        />
      </div>
    </section>
  );
}

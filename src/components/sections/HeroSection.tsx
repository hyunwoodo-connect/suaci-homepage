import Image from "next/image";
import { useTranslations } from "next-intl";
import { SECTION_PADDING_X } from "@/constants/site";

export default function HeroSection() {
  const t = useTranslations("hero");

  return (
    <section className="relative w-full h-screen overflow-hidden">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/home-video.mp4" type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

      <div className={`relative z-10 h-full flex flex-col justify-end ${SECTION_PADDING_X} pb-6 sm:pb-8 md:pb-10`}>
        <Image
          src="/logo.png"
          alt={t("logoAlt")}
          width={1920}
          height={400}
          priority
          className="w-full h-auto object-contain brightness-0 invert opacity-90"
        />
      </div>
    </section>
  );
}

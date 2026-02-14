"use client";

import { useState, useEffect } from "react";

const slides = [
  {
    subtitle: "2025 NEW COLLECTION",
    title: "Define Your\nOwn Style",
    description: "당신만의 감성을 담은 브랜드, SUACI",
    cta: "SHOP NOW",
    bg: "bg-[#1a1a1a]",
  },
  {
    subtitle: "BEST SELLER",
    title: "Timeless\nEssentials",
    description: "매 시즌 사랑받는 SUACI 베스트 아이템",
    cta: "VIEW MORE",
    bg: "bg-[#2a2520]",
  },
  {
    subtitle: "BRAND STORY",
    title: "Crafted\nWith Purpose",
    description: "의미 있는 디테일, SUACI의 이야기",
    cta: "EXPLORE",
    bg: "bg-[#1e2428]",
  },
];

export default function HeroSection() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const slide = slides[current];

  return (
    <section className={`relative w-full h-screen ${slide.bg} transition-colors duration-1000`}>
      {/* Content */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-10 h-full flex flex-col justify-center">
        <div className="max-w-2xl">
          {/* Subtitle */}
          <p className="text-xs md:text-sm tracking-[0.3em] text-white/50 mb-4 md:mb-6 transition-all duration-700">
            {slide.subtitle}
          </p>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-[1.1] tracking-tight mb-6 md:mb-8 whitespace-pre-line transition-all duration-700">
            {slide.title}
          </h1>

          {/* Description */}
          <p className="text-sm md:text-base text-white/60 mb-8 md:mb-12 tracking-wide transition-all duration-700">
            {slide.description}
          </p>

          {/* CTA Button */}
          <button className="group flex items-center gap-3 text-sm tracking-[0.2em] text-white border border-white/30 px-8 py-4 hover:bg-white hover:text-black transition-all duration-500">
            {slide.cta}
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
              className="group-hover:translate-x-1 transition-transform duration-300"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Slide Indicators */}
      <div className="absolute bottom-10 left-6 md:left-10 z-10 flex items-center gap-3">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-[2px] transition-all duration-500 ${
              idx === current
                ? "w-10 bg-white"
                : "w-5 bg-white/30 hover:bg-white/50"
            }`}
            aria-label={`슬라이드 ${idx + 1}`}
          />
        ))}
        <span className="ml-4 text-xs text-white/40 tracking-widest">
          {String(current + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </span>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-10 right-6 md:right-10 z-10 flex flex-col items-center gap-2">
        <span className="text-[10px] tracking-[0.2em] text-white/30 rotate-90 origin-center translate-y-4">
          SCROLL
        </span>
        <div className="w-[1px] h-10 bg-white/20 mt-6 relative overflow-hidden">
          <div className="w-full h-4 bg-white/60 animate-bounce" />
        </div>
      </div>
    </section>
  );
}

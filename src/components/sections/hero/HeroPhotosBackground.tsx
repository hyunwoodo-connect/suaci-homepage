"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { ProductImage } from "@/types";

interface HeroPhotosBackgroundProps {
  photos: readonly ProductImage[];
}

/**
 * Hero 우측 사진 배경.
 * 마우스 이동에 따라 미세하게 translate (±6px). 차분한 parallax.
 * touch/reduced-motion 환경에서는 비활성.
 */
export default function HeroPhotosBackground({ photos }: HeroPhotosBackgroundProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = ref.current;
    if (!el) return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let rafId = 0;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      targetX = ((e.clientX - cx) / rect.width) * 12;
      targetY = ((e.clientY - cy) / rect.height) * 8;
    };

    const tick = () => {
      x += (targetX - x) * 0.055;
      y += (targetY - y) * 0.055;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 will-change-transform">
      {photos.slice(0, 3).map((photo, i) => (
        <Image
          key={photo.src}
          src={photo.src}
          alt={photo.alt}
          fill
          priority={i === 0}
          sizes="(max-width: 900px) 100vw, 58vw"
          className={`hero-photo f${i + 1} object-cover`}
        />
      ))}
    </div>
  );
}

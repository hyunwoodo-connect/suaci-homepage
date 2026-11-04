"use client";

import { useEffect, useRef, useState } from "react";

interface LoopVideoProps {
  webm: string;
  mp4: string;
  /** 화면 읽기용 설명 */
  label: string;
  /** 영상 대신 먼저 보일 그림(없으면 뒤에 깔린 그림이 보인다) */
  poster?: string;
  className: string;
}

/**
 * 무음 반복 영상 — 첫 화면의 글·그림을 다 받은 뒤(load)에야 받기 시작하고, 화면에 들어왔을 때만 돈다.
 * autoplay 로 두면 HTML 을 읽자마자 수백 KB 를 받아 느린 폰에서 첫 그림(포스터)이 1초 넘게 늦었다.
 * 움직임 줄이기를 켠 사람에게는 돌리지 않는다(포스터 = 첫 프레임이 그대로 보인다).
 */
export default function LoopVideo({ webm, mp4, label, poster, className }: LoopVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  // poster 도 화면 근처에 와서야 단다 — video poster 는 lazy 가 없어 첫 화면 아래여도 바로 받는다
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || !poster) return;
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsNear(true);
          near.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    near.observe(video);
    return () => {
      near.disconnect();
    };
  }, [poster]);

  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let observer: IntersectionObserver | null = null;
    const start = () => {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        },
        { rootMargin: "200px 0px" },
      );
      observer.observe(video);
    };

    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      observer?.disconnect();
    };
  }, []);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      poster={isNear ? poster : undefined}
      aria-label={label}
      className={className}
    >
      <source src={webm} type="video/webm" />
      <source src={mp4} type="video/mp4" />
    </video>
  );
}

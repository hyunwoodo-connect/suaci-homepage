"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { blobToDataUrl } from "./canvas";
import { loadLast } from "./strip/storage";

interface ResumeCardProps {
  href: string;
}

/** 입구 `아까 찍은 네컷` 카드. 이 폰에 남은 띠가 있을 때만 보인다(시안 Main resume). */
export default function ResumeCard({ href }: ResumeCardProps) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    loadLast()
      .then((last) => (last ? blobToDataUrl(last.photos) : null))
      .then((url) => {
        if (!isCancelled) setThumb(url);
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, []);

  // 서버 그림엔 카드가 없다(IndexedDB는 폰에만). 띠가 있으면 높이·투명도를 같이 풀어
  // 그림이 툭 줄지 않고 부드럽게 자리를 내준다. 움직임 줄이기면 바로.
  // 비었을 땐 부모 줄 간격(12px)도 음수 여백으로 지운다
  return (
    <div
      aria-hidden={thumb ? undefined : true}
      className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none ${
        thumb ? "grid-rows-[1fr] opacity-100" : "-mb-[12px] grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        {thumb ? (
          <Link
            href={href}
            className="flex items-center gap-[12px] rounded-[16px] bg-(--tf-cream) px-[14px] py-[10px] text-(color:--tf-ink) no-underline"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 폰에 남은 사진(data: URL)이라 next/image 최적화를 못 탄다 */}
            <img
              src={thumb}
              alt=""
              className="box-content block w-[26px] border-2 border-solid border-(--tf-red)"
            />
            <span className="flex-1 text-[15px] leading-[1.4]">
              <b>아까 찍은 네컷</b>이 있어요
            </span>
            <span className="text-[14px]">보기 →</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

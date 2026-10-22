import type { ReactNode } from "react";
import Link from "next/link";

import Pin from "./Pin";

interface NoteStickerProps {
  href: string;
  /** Fraunces 이탤릭 머리(`No.01`) */
  title: string;
  children: ReactNode;
  /** 화면 안 자리. 핀이 붙도록 position을 꼭 준다(기본 relative) */
  className?: string;
}

/** 입구의 기운 크림 쪽지. 핀으로 꽂혀 있다. */
export default function NoteSticker({
  href,
  title,
  children,
  className = "relative",
}: NoteStickerProps) {
  return (
    <Link
      href={href}
      className={`z-[1] box-border block w-[96px] rotate-[6deg] bg-(--tf-cream) px-[10px] pt-[10px] pb-[12px] text-center text-(color:--tf-ink) no-underline shadow-[0_6px_12px_rgba(43,36,32,0.22)] ${className}`}
    >
      <Pin />
      <span className="block font-(family-name:--tf-latin) text-[14px] font-semibold italic">
        {title}
      </span>
      <span className="block pt-[2px] text-[13px] leading-[1.4]">{children}</span>
    </Link>
  );
}

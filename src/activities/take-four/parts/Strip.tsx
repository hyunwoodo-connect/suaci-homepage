import { STRIP_WAVY } from "../paths";
import Pin from "./Pin";
import Stamp from "./Stamp";

interface StripProps {
  /** 합성 결과(blob:·data: URL)나 public 경로 */
  src: string;
  alt: string;
  /** 왼쪽 굵은 번호(`no.0347`) */
  number: string;
  /** 오른쪽 회차·날짜(`No.01 · 12.04`) */
  meta: string;
  /** 도장 글자(`No.01`). 없으면 도장 없음 */
  stamp?: string;
  hasPin?: boolean;
  /** md: 완성 176×506 / lg: 크게 보기 192×552 */
  size?: "md" | "lg";
}

const STRIP_SIZE = {
  md: {
    box: "h-[506px] w-[176px] rotate-[-2deg]",
    photo: "mx-[16px] mt-[16px] h-[450px] w-[144px]",
    shadow: "drop-shadow-[0_10px_14px_rgba(43,36,32,0.25)]",
  },
  lg: {
    box: "h-[552px] w-[192px] rotate-[-1.5deg]",
    photo: "mx-[17px] mt-[17px] h-[494px] w-[158px]",
    shadow: "drop-shadow-[0_12px_16px_rgba(43,36,32,0.28)]",
  },
} as const;

/** 네컷 띠. 물결 테두리 + 사진 + 캡션, 선택으로 도장·핀. */
export default function Strip({
  src,
  alt,
  number,
  meta,
  stamp,
  hasPin = false,
  size = "md",
}: StripProps) {
  const s = STRIP_SIZE[size];
  return (
    <figure className={`relative m-0 shrink-0 ${s.box}`}>
      {stamp ? <Stamp label={stamp} /> : null}
      <svg
        viewBox={STRIP_WAVY.viewBox}
        preserveAspectRatio="none"
        aria-hidden="true"
        className={`absolute inset-0 size-full overflow-visible ${s.shadow}`}
      >
        <path
          d={STRIP_WAVY.d}
          fill="var(--tf-cream)"
          stroke="var(--tf-red)"
          strokeWidth="5"
          strokeLinejoin="round"
        />
      </svg>
      {hasPin ? <Pin size="lg" /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- 합성 결과가 blob: URL이라 next/image 최적화를 못 탄다 */}
      <img src={src} alt={alt} className={`relative block ${s.photo}`} />
      <figcaption className="absolute right-[18px] bottom-[12px] left-[18px] flex justify-between font-(family-name:--tf-latin) text-[12px]">
        <span className="text-[1.15em] font-bold">{number}</span>
        <span className="font-medium">{meta}</span>
      </figcaption>
    </figure>
  );
}

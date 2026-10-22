import { STRIP_WAVY } from "../paths";
import Pin from "./Pin";
import Stamp from "./Stamp";

interface StripProps {
  /** 합성 결과(blob:·data: URL)·public 경로·벽 사진 주소. 없으면 불러오는 중 뼈대 */
  src?: string;
  alt: string;
  /** 왼쪽 굵은 번호(`no.0347`) */
  number: string;
  /** 오른쪽 회차·날짜(`No.01 · 12.04`). 벽 카드에선 `내 거`도 여기 */
  meta: string;
  /** 도장 글자(`No.01`). 없으면 도장 없음 */
  stamp?: string;
  hasPin?: boolean;
  /** red: 기본 / ink: 벽의 내 네컷 */
  frame?: "red" | "ink";
  /** sm: 벽 카드 128×380(기울기는 카드가) / md: 완성 176×506 / lg: 크게 보기 192×552 */
  size?: "sm" | "md" | "lg";
}

const STRIP_SIZE = {
  sm: {
    box: "h-[380px] w-[128px]",
    photo: "mx-[8px] mt-[8px] h-[350px] w-[112px]",
    shadow: "drop-shadow-[0_6px_12px_rgba(43,36,32,0.22)]",
    // 112px 폭에 `no.0347`·`No.01 · 12.04`가 들어가게 시안 카드 캡션(10px)보다 한 단계 작게
    caption: "right-[8px] bottom-[4px] left-[8px] gap-[4px] text-[9px]",
    pin: "sm",
  },
  md: {
    box: "h-[506px] w-[176px] rotate-[-2deg]",
    photo: "mx-[16px] mt-[16px] h-[450px] w-[144px]",
    shadow: "drop-shadow-[0_10px_14px_rgba(43,36,32,0.25)]",
    caption: "right-[18px] bottom-[12px] left-[18px] text-[12px]",
    pin: "lg",
  },
  lg: {
    box: "h-[552px] w-[192px] rotate-[-1.5deg]",
    photo: "mx-[17px] mt-[17px] h-[494px] w-[158px]",
    shadow: "drop-shadow-[0_12px_16px_rgba(43,36,32,0.28)]",
    caption: "right-[18px] bottom-[12px] left-[18px] text-[12px]",
    pin: "lg",
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
  frame = "red",
  size = "md",
}: StripProps) {
  const s = STRIP_SIZE[size];
  return (
    <figure className={`relative m-0 shrink-0 ${s.box}`}>
      {stamp ? <Stamp label={stamp} /> : null}
      {/* stroke 5는 viewBox(176) 기준 — sm(128)에선 시안 카드 테두리 3px 남짓 */}
      <svg
        viewBox={STRIP_WAVY.viewBox}
        preserveAspectRatio="none"
        aria-hidden="true"
        className={`absolute inset-0 size-full overflow-visible ${s.shadow}`}
      >
        <path
          d={STRIP_WAVY.d}
          fill="var(--tf-cream)"
          stroke={frame === "ink" ? "var(--tf-ink)" : "var(--tf-red)"}
          strokeWidth="5"
          strokeLinejoin="round"
        />
      </svg>
      {hasPin ? <Pin size={s.pin} /> : null}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- 합성 결과(blob:)·벽 사진(S3)이라 next/image 최적화를 못 탄다
        <img src={src} alt={alt} className={`relative block ${s.photo}`} />
      ) : (
        <PhotoSkeleton className={s.photo} hasText={size === "lg"} />
      )}
      <figcaption
        className={`absolute flex justify-between font-(family-name:--tf-latin) ${s.caption}`}
      >
        <span className="text-[1.15em] font-bold">{number}</span>
        <span className="font-medium">{meta}</span>
      </figcaption>
    </figure>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface PhotoSkeletonProps {
  className: string;
  /** 크게 보기: 둘째 칸에 `불러오는 중…`(시안 Detail). 벽 뼈대는 묶음이 알린다 */
  hasText: boolean;
}

function PhotoSkeleton({ className, hasText }: PhotoSkeletonProps) {
  const cell = "flex-1 bg-(--tf-skeleton)";
  return (
    <div
      {...(hasText ? { role: "status" } : { "aria-hidden": true })}
      className={`relative flex flex-col ${hasText ? "gap-[10px]" : "gap-[6px] opacity-70"} ${className}`}
    >
      <div className={cell} />
      <div className={`${cell} flex items-center justify-center text-[14px]`}>
        {hasText ? "불러오는 중…" : null}
      </div>
      <div className={cell} />
      <div className={cell} />
    </div>
  );
}

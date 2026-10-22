import { CARD, cellBoxes } from "../strip/layout";

interface CardProps {
  /** 합성 카드(data: URL)·벽 사진 주소. 없으면 불러오는 중 뼈대 */
  src?: string;
  alt: string;
  /** 화면에서의 폭. 높이는 이미지 비율대로 */
  size: CardSize;
  /** 벽·입구: 종이처럼 그림자. 완성·크게 보기는 바탕과 같은 색이라 없음 */
  hasShadow?: boolean;
  /** 벽의 내 네컷: 잉크 외곽선 */
  isMine?: boolean;
}

export type CardSize = keyof typeof CARD_WIDTH;

/** 시안 화면별 카드 폭. resume: 입구 카드 / fill: 벽 칸을 꽉 / print: 현상 / result: 완성 / detail: 크게 보기 */
export const CARD_WIDTH = {
  resume: "w-[34px]",
  fill: "w-full",
  print: "w-[290px]",
  result: "w-[300px]",
  detail: "w-[330px]",
} as const;

/** 카드 비율(합성 카드 크기 그대로). 이미지가 오기 전 자리를 잡는 상자에 */
export const CARD_ASPECT = { aspectRatio: `${CARD.width} / ${CARD.height}` } as const;

/** 뼈대 칸 자리 — 합성과 같은 칸 */
const SKELETON_CELLS = cellBoxes();

/** 네컷 카드 이미지(1080×1350). 저장되는 카드를 그대로 보여 준다. */
export default function Card({ src, alt, size, hasShadow = false, isMine = false }: CardProps) {
  const className = `block h-auto ${CARD_WIDTH[size]} ${
    hasShadow ? "shadow-[0_8px_18px_rgba(43,36,32,0.18)]" : ""
  } ${isMine ? "outline-2 outline-offset-3 outline-(--tf-ink) outline-solid" : ""}`;
  if (!src) return <CardSkeleton className={className} />;
  // eslint-disable-next-line @next/next/no-img-element -- 합성 결과(data:)·벽 사진(S3)이라 next/image 최적화를 못 탄다
  return <img src={src} alt={alt} className={className} />;
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface CardSkeletonProps {
  className: string;
}

/** 불러오는 중 카드: 연두 바탕 + 회색 칸 넷. 알림은 묶음(벽)이나 화면(크게 보기)이 한다 */
function CardSkeleton({ className }: CardSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      data-card-skeleton
      style={CARD_ASPECT}
      className={`relative bg-(--tf-pale) ${className}`}
    >
      {SKELETON_CELLS.map((style) => (
        <div key={style.left + style.top} style={style} className="absolute bg-(--tf-skeleton)" />
      ))}
    </div>
  );
}

/**
 * 불러오는 동안 내용 자리를 같은 크기로 잡아 두는 회색 면. 폭·높이는 className 으로 받는다.
 * 모양은 실제 내용을 따른다 — 글줄은 막대(bar), 상태 뱃지 자리는 badge, 버튼 자리는 알약(pill).
 * 같아야 다 불러온 뒤 화면이 튀지 않는다.
 * 화면 읽기에는 막대마다가 아니라 감싸는 쪽(role="status" + aria-label '불러오는 중…')이 한 번만 알린다.
 */
export type SkeletonShape = "bar" | "badge" | "pill";

interface SkeletonProps {
  className?: string;
  shape?: SkeletonShape;
  /** 글줄 안에 놓을 때 — 줄 높이는 글자가 정하고 막대는 가운데 */
  inline?: boolean;
}

const SHAPE_CLASSES: Record<SkeletonShape, string> = {
  bar: "rounded-[2px]",
  badge: "rounded-[4px]",
  pill: "rounded-full",
};

export default function Skeleton({ className = "", shape = "bar", inline = false }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`${inline ? "inline-block align-middle" : "block"} ${SHAPE_CLASSES[shape]} shrink-0 animate-pulse bg-ink/[0.06] motion-reduce:animate-none ${className}`}
    />
  );
}

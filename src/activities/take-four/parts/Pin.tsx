interface PinProps {
  /** sm: 12px(쪽지·벽) / lg: 16px(크게 보기 띠) */
  size?: "sm" | "lg";
}

/** 빨간 압정. 부모(relative) 위쪽 가운데에 꽂힌다. */
export default function Pin({ size = "sm" }: PinProps) {
  return (
    <span
      aria-hidden="true"
      className={`absolute left-1/2 z-[1] -translate-x-1/2 rounded-full border-solid border-(color:--tf-ink) bg-(--tf-red) ${
        size === "lg" ? "-top-[8px] size-[16px] border-2" : "-top-[6px] size-[12px] border-[1.5px]"
      }`}
    />
  );
}

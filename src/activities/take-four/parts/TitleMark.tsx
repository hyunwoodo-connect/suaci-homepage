interface TitleMarkProps {
  /** md: 입구 64px / lg: PC 안내 88px */
  size?: "md" | "lg";
}

/** `take four.` 제목. */
export default function TitleMark({ size = "md" }: TitleMarkProps) {
  return (
    <h1
      className={`m-0 font-(family-name:--tf-latin) leading-[0.95] font-semibold tracking-[-0.03em] italic ${
        size === "lg" ? "text-[88px]" : "text-[64px]"
      }`}
    >
      take four.
    </h1>
  );
}

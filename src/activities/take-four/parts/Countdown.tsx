interface CountdownProps {
  /** 3·2·1. null이면 비워 둔다(읽기 영역은 남겨서 첫 숫자도 읽힌다) */
  value: number | null;
}

/** 140px 외곽선 숫자. ScallopFrame 창 안에 둔다. 800ms마다 바뀌어 지시 문구(polite)보다 먼저 읽힌다 */
export default function Countdown({ value }: CountdownProps) {
  return (
    <div
      aria-live="assertive"
      className="absolute inset-0 flex items-center justify-center font-(family-name:--tf-latin) text-[140px] font-semibold text-(color:--tf-cream) italic [-webkit-text-stroke:3px_var(--tf-ink)]"
    >
      {value}
    </div>
  );
}

interface CountdownProps {
  /** 3·2·1. 찰칵 순간엔 null */
  count: 3 | 2 | 1 | null;
}

const BEATS = [3, 2, 1] as const;

/**
 * 셔터 자리의 `3 2 1`. 지금 숫자는 크게, 지난 숫자는 더 흐리게. 찰칵 순간엔 `찰칵`.
 * 800ms마다 바뀌어 지시 문구(polite)보다 먼저 읽히게 assertive로, 읽는 건 지금 숫자 하나.
 */
export default function Countdown({ count }: CountdownProps) {
  const at = count === null ? -1 : BEATS.indexOf(count);
  return (
    <div aria-live="assertive" className="flex items-center justify-center gap-[22px]">
      <span className="sr-only">{count ?? "찰칵"}</span>
      {count === null ? (
        <span aria-hidden="true" className="text-[30px] font-bold">
          찰칵
        </span>
      ) : (
        BEATS.map((beat, k) => (
          <span
            key={beat}
            aria-hidden="true"
            data-current={k === at || undefined}
            className={`text-center font-(family-name:--tf-latin) leading-none font-semibold italic ${
              k === at ? "w-[64px] text-[92px]" : "w-[22px] text-[30px]"
            } ${k < at ? "opacity-[0.18]" : k > at ? "opacity-40" : ""}`}
          >
            {beat}
          </span>
        ))
      )}
    </div>
  );
}

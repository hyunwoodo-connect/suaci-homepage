/** `suaci` + 라임 점. 화면 머리 왼쪽(벽은 오른쪽). */
export default function Wordmark() {
  return (
    <span className="font-(family-name:--tf-latin) text-[14px] font-bold tracking-[-0.02em] not-italic">
      suaci
      <span
        aria-hidden="true"
        className="ml-[3px] inline-block size-[6px] rounded-full bg-(--tf-dot) align-middle"
      />
    </span>
  );
}

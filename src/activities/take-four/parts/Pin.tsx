/** 빨간 압정(12px). 부모(relative) 위쪽 가운데에 꽂힌다. */
export default function Pin() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-[6px] left-1/2 z-[1] size-[12px] -translate-x-1/2 rounded-full border-[1.5px] border-solid border-(color:--tf-ink) bg-(--tf-red)"
    />
  );
}

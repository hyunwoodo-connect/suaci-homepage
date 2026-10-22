interface StampProps {
  /** 회차 이름(`No.01`) */
  label: string;
}

/** 회차 이름 기운 빨간 원 도장. 띠 오른쪽 위에 찍힌다(부모 relative). */
export default function Stamp({ label }: StampProps) {
  return (
    <span
      aria-hidden="true"
      data-stamp
      className="absolute top-[20px] -right-[18px] z-[1] box-border flex size-[52px] rotate-[-12deg] items-center justify-center rounded-full border-2 border-solid border-(color:--tf-red) bg-(--tf-cream)/92 font-(family-name:--tf-latin) text-[13px] font-semibold text-(color:--tf-red) italic"
    >
      {label}
    </span>
  );
}

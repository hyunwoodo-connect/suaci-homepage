import Image from "next/image";

interface GirlsIllustrationProps {
  /** 높이 규칙(입구는 남은 높이 ~410px, PC는 520px) */
  className?: string;
}

/** 커튼 뒤 두 소녀(투명 PNG 418×700). 입구·PC. */
export default function GirlsIllustration({ className = "" }: GirlsIllustrationProps) {
  return (
    <Image
      src="/events/take-four/girls-peek.png"
      alt="커튼 뒤에서 고개를 내민 두 소녀가 있는 포토부스"
      width={418}
      height={700}
      className={`block w-auto ${className}`}
    />
  );
}

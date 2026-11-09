import Image from "next/image";

interface ProductShotProps {
  /** 실제 제품 사진 경로(`PRODUCT_PHOTOS`) — 없으면 아무것도 그리지 않는다 */
  src: string | null;
  alt: string;
  /** 폭·여백(배치는 부모가 정한다) */
  className: string;
  sizes: string;
}

/**
 * 실제 제품 사진 자리(4:5, 가운데 기준으로 잘림). 사진이 오기 전에는 칸을 두지 않는다 —
 * 회색 '준비 중' 상자는 무엇을 파는지 보여 주지 못하고 카드사 심사에서 빈 이미지로 읽힌다(UX 리뷰 A1).
 */
export default function ProductShot({ src, alt, className, sizes }: ProductShotProps) {
  if (!src) return null;
  return (
    <div className={`relative aspect-[4/5] overflow-hidden bg-studio ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
    </div>
  );
}

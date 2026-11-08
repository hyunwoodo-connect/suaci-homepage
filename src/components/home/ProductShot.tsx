import Image from "next/image";

import PhotoSoon from "@/components/home/PhotoSoon";

interface ProductShotProps {
  /** 실제 제품 사진 경로(`PRODUCT_PHOTOS`) — 없으면 '준비 중' 자리 */
  src: string | null;
  alt: string;
  /** 사진이 없을 때 보이는 한 줄 */
  soonLabel: string;
  /** 폭·여백(배치는 부모가 정한다) */
  className: string;
  sizes: string;
}

/**
 * 실제 제품 사진 자리. 사진이 오면 '준비 중'과 같은 4:5 틀에 채워(가운데 기준으로 잘림) 배치가 흔들리지 않는다.
 */
export default function ProductShot({ src, alt, soonLabel, className, sizes }: ProductShotProps) {
  if (!src) return <PhotoSoon label={soonLabel} className={className} />;
  return (
    <div className={`relative aspect-[4/5] overflow-hidden bg-studio ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
    </div>
  );
}

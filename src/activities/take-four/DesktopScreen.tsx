import { create } from "qrcode";

import { SITE_HOST } from "@/constants/site";

import GirlsIllustration from "./parts/GirlsIllustration";
import Screen from "./parts/Screen";
import TitleMark from "./parts/TitleMark";
import TopBar from "./parts/TopBar";
import Wordmark from "./parts/Wordmark";

interface DesktopScreenProps {
  slug: string;
  /** 이 이벤트의 절대 주소(허용된 출처 + 미리보기 토큰). QR에 담는다 */
  url: string;
  /** 머리 오른쪽 회차 라벨(`no.01`). 이벤트 내용이 없으면 없음 */
  label?: string;
}

/** PC 안내. 부스는 폰 전용이라 QR이나 주소로 폰으로 옮겨 가게 한다. */
export default function DesktopScreen({ slug, url, label }: DesktopScreenProps) {
  return (
    <Screen tone="lime">
      {/* 시안 PC 칸(420)은 실제 주소가 한 줄에 안 들어가 480으로 넓힌다. Screen 여백(20·24·28)에 더해 시안 PC 여백 28·40·40을 맞춘다 */}
      <div className="flex flex-1 flex-col px-[16px] pt-[8px] pb-[12px]">
        <TopBar start={<Wordmark size="lg" />} label={label} />
        <div className="mx-auto flex w-full max-w-[1040px] flex-1 flex-wrap items-center justify-center gap-x-[80px] gap-y-[48px] py-[32px]">
          <GirlsIllustration className="h-[520px] max-h-[60vh]" />
          <div className="flex max-w-[480px] flex-col gap-[22px]">
            <TitleMark size="lg" />
            <p className="m-0 text-[20px] leading-[1.6]">폰에서만 열려요.</p>
            <div className="flex items-center gap-[20px]">
              <div className="box-border flex size-[148px] shrink-0 items-center justify-center border-[3px] border-solid border-(color:--tf-red) bg-(--tf-cream)">
                <QrCode value={url} />
              </div>
              <div className="flex flex-col gap-[6px] text-[15px]">
                <span>또는 폰에서 직접</span>
                <span className="font-(family-name:--tf-latin) text-[20px] font-bold whitespace-nowrap">
                  {SITE_HOST}/events/{slug}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface QrCodeProps {
  value: string;
}

/** QR 규격의 조용한 구역(칸 수). 주소 길이로 칸이 작아져도 여백은 늘 4칸 */
const QR_QUIET = 4;

/** 서버에서 칸을 계산해 SVG로 그린다(클라이언트 JS 없음). 테두리 안 142px을 꽉 채운다 */
function QrCode({ value }: QrCodeProps) {
  const { size, data } = create(value, { errorCorrectionLevel: "M" }).modules;
  let d = "";
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (data[y * size + x]) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return (
    <svg
      role="img"
      aria-label="폰 카메라로 찍으면 열리는 QR 코드"
      viewBox={`${-QR_QUIET} ${-QR_QUIET} ${size + QR_QUIET * 2} ${size + QR_QUIET * 2}`}
      width="142"
      height="142"
      shapeRendering="crispEdges"
    >
      <rect
        x={-QR_QUIET}
        y={-QR_QUIET}
        width={size + QR_QUIET * 2}
        height={size + QR_QUIET * 2}
        fill="var(--tf-cream)"
      />
      <path d={d} fill="var(--tf-ink)" />
    </svg>
  );
}

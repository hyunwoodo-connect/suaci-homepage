import GirlsIllustration from "./parts/GirlsIllustration";
import Screen from "./parts/Screen";
import TitleMark from "./parts/TitleMark";
import TopBar from "./parts/TopBar";
import Wordmark from "./parts/Wordmark";

interface DesktopProps {
  slug: string;
}

/**
 * PC 안내. 부스는 폰 전용이라 폰으로 옮겨 가게 한다.
 * QR은 시안의 자리 상자 그대로 두고 주소를 같이 적는다 — QR 하나 그리려고 의존성을 들이지 않는다.
 */
export default function Desktop({ slug }: DesktopProps) {
  return (
    <Screen tone="lime">
      {/* 시안 PC 칸(420)은 실제 주소가 한 줄에 안 들어가 480으로 넓힌다. Screen 여백(20·24·28)에 더해 시안 PC 여백 28·40·40을 맞춘다 */}
      <div className="flex flex-1 flex-col px-[16px] pt-[8px] pb-[12px]">
        <TopBar start={<Wordmark size="lg" />} label="no.01" />
        <div className="mx-auto flex w-full max-w-[1040px] flex-1 flex-wrap items-center justify-center gap-x-[80px] gap-y-[48px] py-[32px]">
          <GirlsIllustration className="h-[520px] max-h-[60vh]" />
          <div className="flex max-w-[480px] flex-col gap-[22px]">
            <TitleMark size="lg" />
            <p className="m-0 text-[20px] leading-[1.6]">폰에서만 열려요.</p>
            <div className="flex items-center gap-[20px]">
              <div
                role="img"
                aria-label="QR 코드 자리"
                className="box-border flex size-[148px] shrink-0 items-center justify-center border-[3px] border-solid border-(color:--tf-red) bg-(--tf-cream) font-(family-name:--tf-latin) text-[13px]"
              >
                [QR]
              </div>
              <div className="flex flex-col gap-[6px] text-[15px]">
                <span>또는 폰에서 직접</span>
                <span className="font-(family-name:--tf-latin) text-[20px] font-bold whitespace-nowrap">
                  takesuaci.com/events/{slug}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

import PillButton from "./parts/PillButton";
import Screen from "./parts/Screen";
import TextLink from "./parts/TextLink";
import TopBar from "./parts/TopBar";
import Wordmark from "./parts/Wordmark";
import { androidIntentUrl, detectEnv, kakaoExternalUrl } from "./env";

interface NoCameraScreenProps {
  slug: string;
  /** 요청 UA — 인앱인지 서버에서 가린다 */
  userAgent: string;
  /** 입구의 절대 주소(미리보기 토큰 포함). 밖의 브라우저가 여기서 다시 시작한다 */
  url: string;
}

/**
 * `/events/{slug}/no-camera`. 시안 NoCamera — 카메라가 막혔거나(거절·장치 없음) 인앱이라 안 열릴 때.
 * 막다른 길이 되지 않게 주 행동은 늘 `앨범에서 넉 장 고르기`. 보조 행동은 거절이면 부스로 다시,
 * 인앱이면 밖의 브라우저로 넘기기(넘길 방법이 없는 iOS 인앱은 본문 안내만).
 */
export default function NoCameraScreen({ slug, userAgent, url }: NoCameraScreenProps) {
  const base = `/events/${slug}`;
  const { inApp, os } = detectEnv(userAgent);
  // 입구 인앱 안내와 같은 넘기기: 안드로이드는 크롬 intent, iOS 카카오톡은 외부 열기 스킴
  const handOff = !inApp
    ? null
    : os === "android"
      ? androidIntentUrl(url)
      : os === "ios" && inApp === "kakao"
        ? kakaoExternalUrl(url)
        : null;

  return (
    <Screen tone="lime">
      <TopBar nav={{ icon: "back", label: "밖으로", href: base }} label={<Wordmark />} />

      <div className="pt-[22px] text-center">
        <div className="font-(family-name:--tf-latin) text-[46px] leading-none font-semibold italic">
          hmm.
        </div>
        <h1 className="m-0 mt-[14px] text-[20px] leading-[1.4] font-bold">
          {inApp ? "여기선 카메라가 안 열려요" : "카메라가 막혀 있어요"}
        </h1>
        <p className="m-0 mt-[8px] text-[15px] leading-[1.6] whitespace-pre-line">
          {inApp
            ? "오른쪽 위 ··· 를 누르고\n다른 브라우저로 열어 주세요."
            : "설정에서 카메라를 허용하고 다시 열거나,\n앨범 사진으로 해도 돼요."}
        </p>
      </div>

      <div className="min-h-0 flex-1" />

      <div className="flex flex-col gap-[8px]">
        <PillButton href={`${base}/album`}>앨범에서 넉 장 고르기</PillButton>
        {inApp ? (
          handOff ? (
            <TextLink href={handOff}>다른 브라우저로 열기</TextLink>
          ) : null
        ) : (
          <TextLink href={`${base}/booth`}>허용했어요, 다시 열기</TextLink>
        )}
      </div>
    </Screen>
  );
}

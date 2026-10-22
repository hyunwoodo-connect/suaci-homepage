import Screen from "./parts/Screen";
import TextLink from "./parts/TextLink";
import TopBar from "./parts/TopBar";

interface PreparingScreenProps {
  slug: string;
}

/** 아직 안 만든 하위 화면(부스·앨범·카메라 없을 때·안내). 막다른 길이 되지 않게 입구로 돌려보낸다. */
export default function PreparingScreen({ slug }: PreparingScreenProps) {
  const entrance = `/events/${slug}`;
  return (
    <Screen tone="cream">
      <TopBar nav={{ icon: "back", label: "입구로", href: entrance }} label="no.01" />
      <div className="flex flex-1 flex-col items-center justify-center gap-[8px] text-center">
        <p className="m-0 text-[20px] leading-[1.6]">준비 중이에요.</p>
        <TextLink href={entrance}>입구로 돌아가기</TextLink>
      </div>
    </Screen>
  );
}

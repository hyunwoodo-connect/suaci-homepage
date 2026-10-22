# take four. 부품

시안(`suaci-docs/events/no01-take-four/design/*.dc.html`)에서 여러 화면에 되풀이되는 것. 카드 합성 기하(크기·칸·칸 비율 `CELL_ASPECT`·가장자리 글자 자리·글꼴)는 `../strip/layout.ts` 한 곳에 있고, 합성(`strip/compose.ts`)·화면 부품(`Card` 뼈대·현상 덮개)·촬영/앨범 자르기(`centerCrop`, `ALBUM_FRAME`)가 같이 읽는다. 화면은 이 부품을 조립한다. 시안의 인라인 색·글꼴은 부품과 화면 모두 `--tf-*` 변수(`../theme.ts`)로만 쓴다(변수는 `Screen`이 깐다).

| 부품                | 시안에서 쓰는 곳                            | 내용                                                                                                                                                                                 |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Screen`            | 모든 화면 뿌리                              | 라임/크림/연두(pale) 바탕, 여백 20·24·28, `--tf-*` 변수를 여기서만 깐다                                                                                                              |
| `Wordmark`          | 거의 모든 화면 머리                         | `suaci` + `#738136` 점                                                                                                                                                               |
| `TopBar`            | 거의 모든 화면 머리                         | 왼쪽 44px 뒤로/닫기(또는 Wordmark), 오른쪽 Fraunces 이탤릭 라벨                                                                                                                      |
| `TitleMark`         | Main(64px)·Desktop(88px)                    | `take four.` h1                                                                                                                                                                      |
| `StepBar`           | Main·Booth·Shot                             | 4칸 그라데이션, 찬 칸 수. md 입구 34×8 / sm 촬영 40×6                                                                                                                                |
| `Pin`               | 쪽지·벽 안내                                | 빨간 원 + 잉크 테두리, 부모 위쪽 가운데                                                                                                                                              |
| `NoteSticker`       | Main                                        | 6° 기운 크림 쪽지 + Pin, 링크                                                                                                                                                        |
| `ScallopFrame`      | Booth·Shot1~4                               | `FRAME_SCALLOP` 테두리(선 6) + 타원 창(240×314, 자식이 들어감) + 리본                                                                                                                |
| `Countdown`         | Shot1~4                                     | 셔터 자리 `3 2 1`(지금 92px, 지난 건 흐리게), 찰칵 순간 `찰칵`. 지금 값만 `aria-live`                                                                                                |
| `Flash`             | Booth·Shot                                  | 흰 빛(창 안에 두면 타원)                                                                                                                                                             |
| `Shutter`           | Booth                                       | 글자 없는 80px 원. ready `찍기 시작` / starting `카메라 켜는 중`(회색, 비활성)                                                                                                       |
| `PillButton`        | 거의 모든 화면                              | 58px 잉크 알약(시트 56px, 테두리형 50px), href면 링크. width `fit`은 글자만큼(Booth `다른 방법 보기`)                                                                                |
| `TextLink`          | 거의 모든 화면                              | 44px 밑줄 글자 링크/버튼                                                                                                                                                             |
| `DashedPill`        | Album                                       | `N장 더` 점선 알약, 비활성 버튼                                                                                                                                                      |
| `ShareIcon`         | Result                                      | `공유하기` 버튼 18px 선 아이콘(장식, 숨김)                                                                                                                                           |
| `SaveIcon`          | Result                                      | `저장` 버튼 18px 선 아이콘(장식, 숨김)                                                                                                                                               |
| `Card`              | Main·Print·Result·Wall·Detail               | 합성 카드 이미지(1080×1350) 그대로. 폭은 `CARD_WIDTH`(resume 34 / fill 벽 칸 / print 290 / result 300 / detail 330), 벽·입구는 그림자, 내 거는 잉크 외곽선. 없으면 같은 칸 배치 뼈대 |
| `FitStage`          | Result·Detail                               | 카드 자리. 남은 높이만 차지하고 작은 폰(높이 780px 이하)에선 카드를 줄인다                                                                                                           |
| `RibbonButton`      | Wall·Detail                                 | 리본(나비 매듭) 버튼. sm 36px(이름 `리본 달기`, 수만) / lg 56px 테두리(`리본 달기 N`·`리본 달았어요 N`), `aria-pressed`                                                              |
| `BottomSheet`       | Result(벽에 붙이기)·Detail(신고)·Wall(떼기) | 아래서 올라오는 시트, 뒤 어둡게, `role=dialog`, Esc·바깥 탭으로 닫힘, 포커스 가둠·되돌림                                                                                             |
| `GirlsIllustration` | Main·Desktop                                | `girls-peek.png`(투명 PNG 418×700)                                                                                                                                                   |

## 시안과 일부러 다른 점

- 촬영 창 위 덮개(플래시·켜는 중·막힘)는 시안에서 `top: 33px`이지만 실제 타원 창은 `top: 43px`(viewBox가 y −10에서 시작). 덮개를 창 안에 넣어 창과 딱 맞췄다.
- 시안은 Fraunces 이탤릭을 600, 바로 선 글자를 500·700으로만 싣는다. 이탤릭 라벨은 600, 캡션 날짜는 500으로 맞췄다(가변 글꼴이라 굵기는 클래스로 정한다).
- 셔터 이름은 보이는 글자로 시작한다(`찰칵 — 찍기 시작`). 시안 aria-label `찍기 시작`은 보이는 `찰칵`을 빠뜨린다.
- `Screen`은 전역 body의 `antialiased`를 `subpixel-antialiased`로 되돌린다. 회색조 스무딩이면 Gowun Batang 획이 시안보다 25%쯤 가늘다.
- 글자 링크는 시안의 40px 대신 44px(버튼 높이 ≥ 44 규칙).
- 벽 첫 불러오기 뼈대는 시안(옛 기운 띠 뼈대 그대로)과 달리 카드 모양 뼈대(`Card` 뼈대)다. 크게 보기도 불러오는 동안 같은 뼈대.
- 촬영 화면엔 시안에 없는 저장 영역 안내선(정사각 점선, 밖은 살짝 어둡게)을 그대로 둔다 — 저장되는 칸이 정사각이라 타원 창과 다르다.
- 셔터·현상 시안의 카메라 자리 견본 사진 톤(saturate .9 · contrast .94 · brightness 1.04)을 미리보기와 저장 카드에 같이 건다(`strip/tone.ts`).
- 완성 화면 이미지 이름은 Album 칸 이름(`무표정…박장대소`)을 쓴다. 시안 Result alt는 `정색…빵 터짐`이지만 보이지 않는 글자라 한 목록으로 둔다.
- 벽 리본은 시안처럼 눌러서 끄지 않는다. 네컷당 기기당 한 번(서버 멱등)이라 켜진 뒤엔 그대로.
- 벽은 시안의 고정 높이 안 스크롤 대신 페이지 스크롤 + 아래 고정 `나도 찍기`. 좌우 여백은 다른 화면과 같은 24px(시안 20px).

# take four. 부품

시안(`suaci-docs/events/no01-take-four/design/*.dc.html`)에서 여러 화면에 되풀이되는 것. 화면은 이 부품을 조립한다. 시안의 인라인 색·글꼴은 부품 안에서만 `--tf-*` 변수(`../theme.ts`)로 바뀐다.

| 부품                | 시안에서 쓰는 곳                           | 내용                                                                                                                                                  |
| ------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Screen`            | 모든 화면 뿌리                             | 라임/크림 바탕, 여백 20·24·28, `--tf-*` 변수를 여기서만 깐다                                                                                          |
| `Wordmark`          | Main·Result·Entered 머리 왼쪽, Wall 오른쪽 | `suaci` + `#738136` 점                                                                                                                                |
| `TopBar`            | Booth·Shot·Album·Detail·Wall·Main·Result   | 왼쪽 44px 뒤로/닫기(또는 Wordmark), 오른쪽 Fraunces 이탤릭 라벨                                                                                       |
| `TitleMark`         | Main(64px)·Desktop(88px)                   | `take four.` h1                                                                                                                                       |
| `StepBar`           | Main·Booth·Shot                            | 4칸 그라데이션, 찬 칸 수 + 지금 칸 링                                                                                                                 |
| `Pin`               | 쪽지·띠 위·벽                              | 빨간 원 + 잉크 테두리, 부모 위쪽 가운데                                                                                                               |
| `NoteSticker`       | Main                                       | 6° 기운 크림 쪽지 + Pin, 링크                                                                                                                         |
| `ScallopFrame`      | Booth·Shot1~4                              | `FRAME_SCALLOP` 테두리 + 타원 창(240×314, 자식이 들어감) + 리본                                                                                       |
| `Countdown`         | Booth·Shot                                 | 140px 외곽선 숫자, `aria-live`                                                                                                                        |
| `Flash`             | Booth·Shot                                 | 흰 빛(창 안에 두면 타원)                                                                                                                              |
| `Shutter`           | Booth·Shot                                 | 84px 원. ready `찰칵`(이름 `찰칵 — 찍기 시작`) / starting `…`(`카메라 켜는 중`, 비활성) / running `자동`(`자동 — 다음 장으로 넘어가요`, 비활성)       |
| `PillButton`        | 거의 모든 화면                             | 58px 잉크 알약(시트 56px, 테두리형 50px), href면 링크                                                                                                 |
| `TextLink`          | 거의 모든 화면                             | 44px 밑줄 글자 링크/버튼                                                                                                                              |
| `DashedPill`        | Album                                      | `N장 더` 점선 알약, 비활성 버튼                                                                                                                       |
| `ShareIcon`         | Result                                     | `공유하기` 버튼 18px 선 아이콘(장식, 숨김)                                                                                                            |
| `SaveIcon`          | Result                                     | `저장` 버튼 18px 선 아이콘(장식, 숨김)                                                                                                                |
| `Strip`             | Result·Detail·Wall                         | `STRIP_WAVY` 테두리 + 사진 + 캡션, 선택 Stamp(`stamp` 글자)·Pin. sm 128×380(벽 카드, 내 거는 잉크 테두리) / md 176×506 / lg 192×552. 사진 없으면 뼈대 |
| `Stamp`             | Result·Detail                              | 회차 이름(`No.01`) 기운 빨간 원 도장                                                                                                                  |
| `RibbonButton`      | Wall·Detail                                | 리본(나비 매듭) 버튼. sm 36px(이름 `리본 달기`, 수만) / lg 56px 테두리(`리본 달기 N`·`리본 달았어요 N`), `aria-pressed`                               |
| `BottomSheet`       | Result(응모)·Entered·Detail·Wall           | 아래서 올라오는 시트, 뒤 어둡게, `role=dialog`, Esc·바깥 탭으로 닫힘, 포커스 가둠·되돌림                                                              |
| `GirlsIllustration` | Main·Desktop                               | `girls-peek.png`(투명 PNG 418×700)                                                                                                                    |

## 시안과 일부러 다른 점

- 촬영 창 위 덮개(카운트다운·플래시·켜는 중)는 시안에서 `top: 33px`이지만 실제 타원 창은 `top: 43px`(viewBox가 y −10에서 시작). 덮개를 창 안에 넣어 창과 딱 맞췄다.
- 시안은 Fraunces 이탤릭을 600, 바로 선 글자를 500·700으로만 싣는다. 이탤릭 라벨은 600, 캡션 날짜는 500으로 맞췄다(가변 글꼴이라 굵기는 클래스로 정한다).
- 셔터 이름은 보이는 글자로 시작한다(`찰칵 — 찍기 시작`). 시안 aria-label `찍기 시작`은 보이는 `찰칵`을 빠뜨린다.
- `Screen`은 전역 body의 `antialiased`를 `subpixel-antialiased`로 되돌린다. 회색조 스무딩이면 Gowun Batang 획이 시안보다 25%쯤 가늘다.
- 글자 링크는 시안의 40px 대신 44px(버튼 높이 ≥ 44 규칙).
- Wall의 작은 네컷 카드(시안: 테두리 3px 사각형, 캡션 `take four.`)는 `Strip` sm으로 그린다. `STRIP_WAVY`가 사실상 곧은 사각형이라 모양이 같고, 캡션은 벽 네컷 번호·회차(`no.0347` · `No.01 · 12.04`)를 쓴다 — 내 거면 오른쪽이 `내 거`. Entered 카드는 3단계에서 정한다.
- 벽 리본은 시안처럼 눌러서 끄지 않는다. 네컷당 기기당 한 번(서버 멱등)이라 켜진 뒤엔 그대로.
- 벽은 시안의 고정 높이 안 스크롤 대신 페이지 스크롤 + 아래 고정 `나도 찍기`. 좌우 여백은 다른 화면과 같은 24px(시안 20px).

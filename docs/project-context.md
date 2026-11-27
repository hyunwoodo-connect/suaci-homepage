# suaci — 프로젝트 컨텍스트 (2026-10-18 기준)

> 브랜드·비주얼·진행 상황. 코드 규칙은 `AGENTS.md`. claude.ai 프로젝트 지식으로 붙여 넣어도 된다.
>
> **⚠️ 브랜드 최신 기준 (2026-10-27 확정):** 키컬러 **#A9FF39** · 제품명 **'라임바질 페이셜 세럼 미스트 · take-01'** (**'brume no.1' 폐기**). 전체 기준은 suaci 서랍 `브랜드/최신기준.md` + `패키지 브리프 v1.1`. 사이트 코드의 제품명·키컬러·ink는 2026-11-01에 교체했다(옛 값 `brume no.1`·`#738136`·`#111111` 없음).

## 일하는 규칙 (반드시)

- 답변은 **한국어**로.
- **이미지·영상 생성(크레딧 소모)은 바로 하지 않는다.** 먼저 계획·프롬프트·비용을 제안하고 확인("ㄱㄱ", "응", "해봐")을 받은 뒤 생성.
- 타사 브랜드 에셋을 우리 브랜드 이미지로 가공하지 않는다(리라벨·합성·얼굴 교체 금지). 레퍼런스는 그대로 두고 "reference · replace before launch" 태그를 붙인다.
- 실사풍 AI 모델 컷은 **시안용 자리 채움**. 출시 전 실사로 교체.
- 히어로 영상에 모션 블러·크로스페이드 등 효과를 넣지 않는다. 원본 하드컷 루프.
- 저장소 작업은 검증(`npx tsc --noEmit` · `pnpm lint` · `pnpm test`) 통과 후 완료 선언. 모바일 우선 확인. 오너가 "main에서 바로" 지시 → 브랜치 없이 main 커밋.

## 브랜드

- 브랜드 **suaci** (워드마크 소문자). 코스메틱 D2C, 개발자 도현우 + 파트너.
- 제품 **라임바질 페이셜 세럼 미스트 · take-01** (영문 lime & basil facial serum mist), **100 ml, 단일 SKU**. 임시 가격 ₩28,000. (옛 'brume no.1' 폐기. 정확한 제품명 문자열은 진시우 최종.)
- 슬로건 **take suaci.** (take a break → take suaci). 브랜드 성격: **유쾌한 리프레쉬**. 명상·힐링·진정 톤 아님.
- 브랜드 스토리 한 줄: "for the days your mind gets sensitive before your skin does." 본문: "people, pings, all day long. some days it's not your skin that needs a break first. / suaci is a quick, playful refresh. not silence, not meditation. just a spray, a little laugh, and back to your day."
- 사이트 언어 **한국어(기본, 2026-10-26 #93) + 영어 + 일본어**. 영문 카피 **전부 소문자**. 미니멀 카피.
- 금지 표현: 치료/효과/개선, 기능성 암시. "no sting" 류 문구는 출시 전 표현 가능 여부 확인 필요.

## 비주얼

- 흰 바탕, 넓은 여백, 풀블리드 사진. 스튜디오 그레이(#d3d4d8) 룩북 사진 + **키컬러 하나**.
- 팔레트: **키컬러 `lime #A9FF39`**(10/27 확정 · 점·띠·블록 하나로만) · `ink #141414` · `paper #ffffff` · `studio #d3d4d8` · `grey #5f5f5c` · `line #e4e5e8`. 매우 밝아 **글자색으로 쓰지 않는다**(흰 바탕 위 라임 글자·라임 위 흰 글자 모두 안 읽힘) — 라임 위 글자는 ink.
- 폰트(브랜드 기준 Geist·Pretendard, 2026-11-04): Geist 는 next/font(`src/lib/fonts.ts`, [locale] 전용 — 이벤트 레이아웃은 자기 파일에서 따로 부른다. 같은 호출을 두 레이아웃에 두면 글꼴 CSS 가 합쳐져 홈이 이벤트 글꼴 조각을 미리 받는다). 한글은 Pretendard, 일본어 화면은 Pretendard JP — 둘 다 jsdelivr 동적 조각판(`src/constants/fonts.ts`). 언어별 한중일 글꼴은 `--font-cjk` 변수(globals.css). 일본어는 `palt`. 소문자 본문엔 자간 금지.
- 로고는 헤더·푸터 모두 **검정**. SVG(`public/brand/logo-black.svg`, `logo-white.svg`) — 서랍 `브랜드/에셋/suaci_logo.zip`(PNG 01·02)과 같은 모양. 옛 손글씨 대문자 로고(`logo.png`)는 지웠다.
- 파비콘·아이콘은 워드마크의 `s`를 라임 바탕에 ink로(`src/app/favicon.ico`·`apple-icon.png`, 매니페스트 `public/brand/icon-{192,512}.png`). 공유 미리보기(OG)는 paper `#FAFAF7` 위 워드마크 + 아래 라임 띠(`src/app/opengraph-image.png`).
- 모델: 20대 중후반 동아시아 여성, 밝고 행복한 표정(무표정 X), 포즈 반복 X. 히어로 모델(라임 니트 카디건) 컷을 레퍼런스로 유지.
- 배경색은 스튜디오 그레이로 통일. 라임이 매번 등장하는 건 지양, 라임 **색**을 쓰는 쪽.

## 홈 구성 (v5 "white studio")

헤더(로고 / 이벤트 · 언어 · 계정 아이콘, 구매 버튼 없음. '이벤트' 메뉴는 take four 를 닫아 둔 동안 숨김(2026-11-10 오너 — `constants/site` 의 `IS_EVENTS_MENU_VISIBLE`, `/events` 주소는 그대로 열림). 누르는 칸 44px. 언어는 `home/LanguageMenu` — 지구본 + 지금 언어(ko·en·ja, 주소와 같은 언어 코드) 단추를 누르면 한국어·english·日本語 목록, 지금 언어에 라임 동그라미 체크. 폰도 같은 헤더) → 히어로(룩북 루프 영상 5초, 무음 자동재생, 포스터 = 첫 프레임 — 영상 뒤 picture 로, 458px 이하 폰은 가운데만 자른 `hero-poster-m.webp`, 영상은 `home/LoopVideo` — 첫 화면을 받은 뒤 화면에 들어올 때만 돌고 움직임 줄이기면 멈춤, 캡션 줄 오른쪽 끝 멈춤·재생 버튼(웹 접근성 2.2.2, 물결 영상도 같음), 캡션 "take suaci. — lime & basil facial serum mist") → 브랜드 스토리(작은 글씨, 점+our story, take ~~a break~~ suaci.) → 제품 섹션(2026-11-09 UX 리뷰 A2로 갤러리 앞으로 — 히어로 캡션 둘째 줄도 '상품 · 100 ml · 가격') → 무드 갤러리 7컷 엇갈림(소파 "3pm. inbox full." / 스마일 종이 "after the meeting." / 물결 풀블리드 / 턴테이블 라임 / 모델+보틀(→ '제품 사진 준비 중' 자리) / 메탈 바구니 라임 / 라임 귀걸이) → 제품 섹션(큰 컷 자리+텍스트, 접이식 how to use·ingredients·shipping) → 푸터(슬로건, 링크, 법적 표기, 하단에 잘려 나가는 대형 로고) → **하단 원클릭 바 = 유일한 구매 CTA**(구매 시트: 수량, apple pay / google pay / 카드).

## 저장소 `suaci-official` 상태

- Next.js 16 · React 19 · Tailwind v4 · next-intl · pnpm. AWS Amplify 호스팅(main 푸시 시 자동 배포), GitHub `hyunwoodo-connect/suaci-homepage`.
- 라우팅 `ko`(기본, 접두사 없음 — 2026-10-26 #93) + `en` + `ja`. 카탈로그 키 일치는 `src/messages/messages.test.ts`가 지킨다.
- 라우트: `/` · `/checkout` · `/orders` · `/orders/[id]` · `/account` · `/account/addresses` · `/login` · `/signup` · `/password/*` · `/legal/[slug]`(terms·privacy·refund·business, 백엔드 `GET /legal/{slug}` 마크다운을 react-markdown으로, 원시 HTML 차단) · `/legal/[slug]/[version]`(개정 이력). 정책 본문은 코드에 없고 관리 툴(admin.takesuaci.com)에서 판(버전)으로 고친다. 2026-10-23. 상품목록·브랜드·장바구니는 **제거**(단일 SKU). `@/lib/api` seam은 지금 쓰는 메서드만 둔다(YAGNI).
- 홈 컴포넌트 `src/components/home/`: SiteHeader, Hero, Story, Moments, ProductSection, SiteFooter, BuyBar(하단 구매 바). 상수 `src/constants/product.ts`.
- 에셋: `public/image/v5/`, `public/video/v5/hero.{mp4,webm}`, `public/brand/`. v5 그림·영상은 1년 캐시(`customHttp.yml`, immutable) — 파일을 바꿀 땐 같은 이름으로 덮지 말고 새 이름·새 폴더(v6)로. brand/ 는 하루.
- 기능별 세부(결제·로그인·소셜·어댑터 모드·제품 사진 자리·출시 전 구매 차단·비밀번호 칸·회원 탈퇴·화면 공통·구매 흐름과 주문·클레임)는 `docs/site-notes.md`. 늘 싣지 않는다 — 고칠 기능 이름으로 `grep -n` 해서 그 줄만 읽는다.
- 최근 커밋: v5 리디자인 → 코드 점검 → 히어로 v2 영상(크로스페이드 제거) → 제품 섹션 재구성.

## 디자인 캔버스

- claude.ai Design 아티팩트 "suaci Web": Main(1440, fluid) / Tablet / Mobile / Buy sheet / Color system 보드. 저장소와 동일한 v5 상태.

## 도구

- 이미지 생성: Higgsfield `gpt_image_2_5`(high, 2k, 2.75cr). 모델 일관성은 히어로 컷 job을 `image_references`로.
- 영상: 어도비 Firefly로 뽑은 테이크 사용 중. 힉스필드 대안은 Kling 3.0 Pro(5초 약 8.75cr). Seedance 2.5는 비쌈.
- 루프 처리: 원본 그대로 하드컷. 첫/끝 프레임 차이가 작아 이음새 거의 안 보임.

## 남은 일

- 바구니 컷 라임이 너무 큼 → 재생성(확인 후)
- 헤더 스크롤 동작, 구매 시트 포커스 트랩
- 일본어 카피 다듬기, 엔화 표기 정책
- 特定商取引法 페이지(2차 일본). 정책 4종·푸터 링크는 2026-10-23 끝(백엔드 판 관리), 인스타그램 링크 2026-11-01
- 실제 제품 컷으로 교체, 제품 카피(사용법·전성분·배송)
- Stripe·소셜 로그인·게스트 주문 연동

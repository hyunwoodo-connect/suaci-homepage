# suaci — 프로젝트 컨텍스트 (2026-10-18 기준)

> 브랜드·비주얼·진행 상황. 코드 규칙은 `AGENTS.md`. claude.ai 프로젝트 지식으로 붙여 넣어도 된다.

## 일하는 규칙 (반드시)

- 답변은 **한국어**로.
- **이미지·영상 생성(크레딧 소모)은 바로 하지 않는다.** 먼저 계획·프롬프트·비용을 제안하고 확인("ㄱㄱ", "응", "해봐")을 받은 뒤 생성.
- 타사 브랜드 에셋을 우리 브랜드 이미지로 가공하지 않는다(리라벨·합성·얼굴 교체 금지). 레퍼런스는 그대로 두고 "reference · replace before launch" 태그를 붙인다.
- 실사풍 AI 모델 컷은 **시안용 자리 채움**. 출시 전 실사로 교체.
- 히어로 영상에 모션 블러·크로스페이드 등 효과를 넣지 않는다. 원본 하드컷 루프.
- 저장소 작업은 검증(`npx tsc --noEmit` · `pnpm lint` · `pnpm test`) 통과 후 완료 선언. 모바일 우선 확인. 오너가 "main에서 바로" 지시 → 브랜치 없이 main 커밋.

## 브랜드

- 브랜드 **suaci** (워드마크 소문자). 코스메틱 D2C, 개발자 도현우 + 파트너.
- 제품 **brume no.1** — lime & basil face mist, **100 ml, 단일 SKU**. 임시 가격 ₩38,000.
- 슬로건 **take suaci.** (take a break → take suaci). 브랜드 성격: **유쾌한 리프레쉬**. 명상·힐링·진정 톤 아님.
- 브랜드 스토리 한 줄: "for the days your mind gets sensitive before your skin does." 본문: "people, pings, all day long. some days it's not your skin that needs a break first. / suaci is a quick, playful refresh. not silence, not meditation. just a spray, a little laugh, and back to your day."
- 사이트 언어 **영어(기본) + 일본어 + 한국어**(`/ko`, 2026-10-23 추가. 기본 언어 결정은 열려 있음). 영문 카피 **전부 소문자**. 미니멀 카피.
- 금지 표현: 치료/효과/개선, 기능성 암시. "no sting" 류 문구는 출시 전 표현 가능 여부 확인 필요.

## 비주얼

- 흰 바탕, 넓은 여백, 풀블리드 사진. 스튜디오 그레이(#d3d4d8) 룩북 사진 + **키컬러 하나**.
- 팔레트: `lime #738136`(키컬러, 점·작은 디테일만) · `ink #111111` · `paper #ffffff` · `studio #d3d4d8` · `grey #5f5f5c` · `line #e4e5e8`. 네온 그린(#a9ff39)은 **폐기**.
- 폰트: Geist + Zen Kaku Gothic New(일본어) + Noto Sans KR(한국어). 소문자 본문엔 자간 금지.
- 로고는 헤더·푸터 모두 **검정**. SVG(`public/brand/logo-black.svg`, `logo-white.svg`).
- 모델: 20대 중후반 동아시아 여성, 밝고 행복한 표정(무표정 X), 포즈 반복 X. 히어로 모델(라임 니트 카디건) 컷을 레퍼런스로 유지.
- 배경색은 스튜디오 그레이로 통일. 라임이 매번 등장하는 건 지양, 라임 **색**을 쓰는 쪽.

## 홈 구성 (v5 "white studio")

헤더(로고 / en·jp·kr / 계정 아이콘, 구매 버튼 없음) → 히어로(룩북 루프 영상 5초, 무음 자동재생, 포스터 = 첫 프레임, 캡션 "take suaci. brume no.1 — lime & basil face mist") → 브랜드 스토리(작은 글씨, 점+our story, take ~~a break~~ suaci.) → 무드 갤러리 7컷 엇갈림(소파 "3pm. inbox full." / 스마일 종이 "after the meeting." / 물결 풀블리드 / 턴테이블 라임 / 모델+보틀 / 메탈 바구니 라임 / 라임 귀걸이) → 제품 섹션(큰 컷+텍스트, 디테일 컷 2장, 접이식 how to use·ingredients·shipping) → 푸터(슬로건, 링크, 법적 표기, 하단에 잘려 나가는 대형 로고) → **하단 원클릭 바 = 유일한 구매 CTA**(구매 시트: 수량, apple pay / google pay / 카드).

## 저장소 `suaci-official` 상태

- Next.js 16 · React 19 · Tailwind v4 · next-intl · pnpm. AWS Amplify 호스팅(main 푸시 시 자동 배포), GitHub `hyunwoodo-connect/suaci-homepage`.
- 라우팅 `en`(접두사 없음) + `ja` + `ko`. 카탈로그 키 일치는 `src/messages/messages.test.ts`가 지킨다.
- 라우트: `/` · `/checkout` · `/orders` · `/orders/[id]` · `/account` · `/account/addresses` · `/login` · `/signup` · `/password/*`. 상품목록·브랜드·장바구니는 **제거**(단일 SKU). `@/lib/api` seam은 지금 쓰는 메서드만 둔다(YAGNI).
- 홈 컴포넌트 `src/components/home/`: SiteHeader, Hero, Story, Moments, ProductSection, SiteFooter, BuyBar. 상수 `src/constants/product.ts`.
- 에셋: `public/image/v5/`, `public/video/v5/hero.{mp4,webm}`, `public/brand/`.
- 결제·로그인: **UI만** 디자인대로. 동작은 seam mock. TODO: Stripe(Apple/Google Pay), Cognito federated(google/apple/line), **게스트 주문 백엔드 계약**(현재는 로그인+배송지 필요).
- 제품 섹션 사진 3장은 퓨리토 레퍼런스 — 출시 전 교체.
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
- 정책 페이지·特定商取引法 페이지·주문 조회, 푸터 `#` 링크
- 실제 제품 컷으로 교체, 제품 카피(사용법·전성분·배송)
- Stripe·소셜 로그인·게스트 주문 연동

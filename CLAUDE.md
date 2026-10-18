# CLAUDE.md — SUACI 프로젝트 컨텍스트

> Claude Code가 세션마다 읽는 프로젝트 브리프. 코드 컨벤션은 `AGENTS.md`, 브랜드·작업 맥락 전체는 `docs/project-context.md`.

---

## 1. 현행 — v5 "white studio"

- **사이트 성격**: 단일 SKU 원페이지. 제품명 **brume no.1** (lime & basil face mist · 100 ml). 브랜드 무드는 **유쾌한 리프레쉬**(명상·힐링·진정 톤 아님). 슬로건 **take suaci.** (take a break → take suaci).
- **언어**: `en`(기본, 접두사 없음) + `ja`(`/ja`). **영문 카피는 전부 소문자.** 헤더에 en / jp 스위처 노출.
- **팔레트** (`globals.css @theme`가 권위): `lime #738136`(키컬러, 점·작은 디테일만) · `ink #111111` · `paper #ffffff` · `studio #d3d4d8`(사진 배경) · `grey #5f5f5c` · `line #e4e5e8`.
- **폰트**: Geist + Zen Kaku Gothic New(일본어).
- **홈 구성** (`src/components/home/`): SiteHeader → Hero(루프 영상) → Story → Moments(엇갈린 7컷) → ProductSection → SiteFooter → BuyBar(하단 원클릭 바 = 유일한 구매 CTA, 구매 시트 포함).
- **에셋**: `public/image/v5/`, `public/video/v5/`, `public/brand/`. 경로 상수는 `src/constants/product.ts`. 사진은 시안용 AI 컷 — 출시 전 실사로 교체. `product-reference.webp`는 **타사(Purito) 레퍼런스**라 출시 전 반드시 교체.
- **라우트**: `/` · `/checkout` · `/orders` · `/orders/[id]` · `/account` · `/account/addresses` · `/login` · `/signup` · `/password/*`.
- **결제/로그인**: UI만 디자인대로(apple pay / google pay / 카드, google·apple·line 로그인 버튼). 실제 동작은 seam mock. TODO: Stripe 연동, Cognito federated 로그인, **게스트 주문 계약(백엔드)** — 지금은 로그인+배송지 필요.
- 가격 임시 ₩38,000 (fixtures `var_daily_80`).

## 2. 카피 보이스

- 과장 금지. "치료/효과/개선" 등 기능성 암시 단어 절대 사용 금지. 짧은 호흡. 이모지·느낌표 금지.
- 워드마크는 항상 소문자 `suaci`.

## 3. 백엔드 연동 (seam)

- 데이터 접근은 전부 `@/lib/api` 하나로 모인다. 지금은 mock 구현, `NEXT_PUBLIC_API_MODE=mock→http`로 실백엔드에 붙는다. 타입(`src/types/*`)은 백엔드 DTO에 1:1.
- 백엔드는 별도 레포 `../suaci-official-backend`. 프론트에서 DB 직접 접근·자체 인증 라이브러리·결제 로직 금지 — seam 뒤로만 호출한다. 계약(DTO) 변경이 필요하면 오너에게 보고.
- **YAGNI**: 지금 화면에서 안 쓰는 API 메서드·타입·로케일은 두지 않는다. 필요해지면 그때 추가.

## 4. 배포 / CI

- GitHub `hyunwoodo-connect/suaci-homepage`. 호스팅은 **AWS Amplify**(SSR, 서울 리전) — main 푸시 시 자동 배포, 빌드 설정은 `amplify.yml`.
- CI는 `.github/workflows/ci.yml` (PR·main 푸시마다 lint / tsc / test / build).
- Node는 `.nvmrc`(24). Node 25에서는 내장 localStorage가 jsdom을 가려 `pnpm test`가 실패한다.

## 5. 디자인 / 모션 원칙

- 흰 바탕, 넓은 여백, 풀블리드 사진. 여백이 디자인이다.
- **Bouncy 금지.** `ease-out` 위주, 600~1200ms. 한 화면에 모션은 한두 개. 히어로 영상에 블러·크로스페이드 등 효과 금지(원본 하드컷 루프).

## 6. 일하는 방식

0. **모델은 opus만.** 모든 `Agent` 디스패치는 `model: "opus"`로 고정. (오너 명시 — 2026-05-13)
1. **창의적 작업(새 페이지/섹션/기능)은 PM부터.** `pm` 에이전트로 스펙을 받은 뒤 `frontend-engineer`로 넘긴다. 스펙이 명확한 순수 구현은 바로 `frontend-engineer`.
2. **시각 작업에는 `frontend-design` 스킬을 반드시 쓴다.**
3. **AGENTS.md 컨벤션 엄수.**
4. **검증 없이 완료 선언 금지.** 최소 `npx tsc --noEmit` · `pnpm lint` · `pnpm test` 통과. 시각 작업은 dev server에서 **모바일 우선**으로 확인.
5. **모바일 우선.** 오너가 데스크탑 디자인을 직접 담당한다. Claude는 모바일 반응형을 책임지고, 데스크탑 세부는 오너가 얹을 여지를 남긴다.
6. **작업 브랜치.** 기본은 작업별 브랜치 → 검증 통과 후 main 머지. 오너가 "메인에서 해"라고 하면 main 직접 커밋 허용(검증은 동일).
7. **이미지·영상 생성(크레딧 소모)은 바로 하지 않는다.** 계획·프롬프트·비용을 먼저 제안하고 확인받는다.
8. **삭제된 기능**: skin-check / 퍼스널 컬러 기능(2026-05-10 제거)은 부활시키지 않는다.

## 7. 빠른 참조

| 찾고 싶은 것            | 어디에 있나                                                                   |
| ----------------------- | ----------------------------------------------------------------------------- |
| 코드 스타일·스택·네이밍 | `AGENTS.md`                                                                   |
| 브랜드·비주얼·남은 일   | `docs/project-context.md`                                                     |
| 카피 (en/ja)            | `src/messages/{en,ja}.json`                                                   |
| 제품 데이터             | 홈 상수 `src/constants/product.ts` · seam 픽스처 `src/data/fixtures/index.ts` |
| API seam                | `src/lib/api/` · DTO 타입 `src/types/` · 포맷 `src/lib/format.ts`             |
| 인증/카트 컨텍스트      | `src/lib/auth/`, `src/lib/cart/`                                              |
| 에이전트                | `.claude/agents/{pm,frontend-engineer}.md`                                    |
| 디자인 레퍼런스         | `docs/references/`                                                            |

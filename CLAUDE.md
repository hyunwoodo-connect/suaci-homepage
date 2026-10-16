# CLAUDE.md — SUACI 프로젝트 컨텍스트

> 이 파일은 Claude Code가 모든 세션 시작 시 자동으로 읽는 프로젝트 브리프다.
> 기술 컨벤션은 `AGENTS.md`, 브랜드 카피는 `docs/site-copy.md`를 참조한다.
> 이 문서는 **WHO / WHAT / WHY**를 정의한다. HOW는 위 두 문서가 담는다.

---

## 0. 현행 — v5 "white studio" (2026-10, 이 섹션이 아래 내용보다 우선)

- **사이트 성격**: 단일 SKU 원페이지. 제품명 **brume no.1** (lime & basil face mist · 100 ml). 브랜드 무드는 **유쾌한 리프레쉬**(명상·힐링·진정 톤 아님). 슬로건 **take suaci.** (take a break → take suaci).
- **언어**: `en`(기본, 접두사 없음) + `ja`(`/ja`). ko/zh/th 메시지는 보관만, 라우팅 제외. **영문 카피는 전부 소문자.** 헤더에 en / jp 스위처 노출.
- **팔레트** (`globals.css @theme`가 권위): `lime #738136`(키컬러, 점·작은 디테일만) · `ink #111111` · `paper #ffffff` · `studio #d3d4d8`(사진 배경) · `grey #5f5f5c` · `line #e4e5e8`. v4 토큰명(acid 등)은 서브페이지 호환용 별칭.
- **폰트**: Geist + Zen Kaku Gothic New(일본어).
- **홈 구성** (`src/components/home/`): SiteHeader → Hero(루프 영상) → Story → Moments(엇갈린 7컷) → ProductSection → SiteFooter → BuyBar(하단 원클릭 바 = 유일한 구매 CTA, 구매 시트 포함).
- **에셋**: `public/image/v5/`, `public/video/v5/`, `public/brand/`. 경로 상수는 `src/constants/product.ts`. 사진은 시안용 AI 컷 — 출시 전 실사로 교체. `product-reference.webp`는 **타사(Purito) 레퍼런스**라 출시 전 반드시 교체.
- **라우트**: `/` · `/checkout` · `/orders` · `/orders/[id]` · `/account` · `/account/addresses` · `/login` · `/signup` · `/password/*`. 상품목록·브랜드·장바구니 라우트는 제거(단일 SKU). seam·타입은 유지해 확장 가능.
- **결제/로그인**: UI만 디자인대로(apple pay / google pay / 카드, google·apple·line 로그인 버튼). 실제 동작은 seam mock. TODO: Stripe 연동, Cognito federated 로그인, **게스트 주문 계약(백엔드)** — 지금은 로그인+배송지 필요.
- 가격 임시 ₩38,000 (fixtures `var_daily_80`).

> 아래 1~10은 v4 이전 기록이다. 충돌 시 이 섹션을 따른다.

---

## 1. 이 프로젝트가 뭐인가

**SUACI**는 한국의 코스메틱 D2C 브랜드다. 대표 제품에서 출발해 **큐레이션 커머스 샵**으로 확장 중이다.

- **대표 제품**: SUACI **Daily Calming Mist** — 100ml, 휴대용 카밍 미스트 (홈의 히어로)
- **카탈로그**: 브랜드 → 상품 → 옵션(variant) 구조. SUACI 자체 + 큐레이션 파트너 브랜드를 함께 담을 수 있다.
- **포지셔닝**: "좋아지게 만들기보다, 무너지지 않게." 진정에 필요한 성분만 추려 만든 포터블 미스트.
- **현재 단계**: **커머스 통합(mock-first).** UI는 목데이터로 동작하되, 백엔드 커머스 API(9도메인) 계약(DTO)에 1:1로 맞춰 만든다. 데이터 접근은 단일 seam(`@/lib/api`)으로 몰려 있어 배포 후 `NEXT_PUBLIC_API_MODE=mock→http` 한 줄로 실백엔드에 붙는다. 설계: `docs/superpowers/specs/2026-07-20-frontend-commerce-integration-design.md`. 백엔드는 별도 레포 `../suaci-official-backend`.

---

## 2. 브랜드 정체성

| 항목 | 값 |
|---|---|
| 브랜드명 | **SUACI** |
| 워드마크 | 소문자 `suaci` (절대 SUACI 대문자로 로고화하지 않는다) |
| 제품명 (라벨) | `DAILY CALMING MIST` (대문자, 분리 표기) |
| 용량 | 100ml |
| 슬로건 | `Calm your skin, wherever you are.` |
| 한 문장 | `피부가 흔들리는 순간을 줄이는, 데일리 카밍 미스트.` |
| 카피 보이스 규칙 | `docs/site-copy.md` 섹션 0 참조 (이게 권위) |

**카피 보이스 핵심 한 줄**: 과장 금지. "치료/효과/개선" 단어 절대 사용 금지. 짧은 호흡. 관찰자 시점. 이모지/느낌표 금지.

---

## 3. 디자인 방향 (가장 중요)

### 톤
- **일본 매거진 (예: POPEYE, &Premium, BRUTUS, Casa BRUTUS) 미감.** 흰 바탕, 넓은 여백, 단정한 그리드, 작은 영문 캡션이 한국어 본문 옆에 자연스럽게 얹히는 편집형 레이아웃.
- **여백이 디자인이다.** 비어있음을 두려워하지 않는다. 한 화면에 보이는 정보는 적게.
- **모션은 "멋지게"** — 정적인 레이아웃을 보완하는 모션이 들어간다. 작지만 의도가 분명한 움직임. Lenis 같은 스무스 스크롤, 섹션 진입 시 페이드/슬라이드, 스크롤 연동 타이포, 제품 컷의 미세한 호흡(부유 애니메이션 등). **튀지 않지만 기억에 남는** 결.

### 모션 원칙 (frontend-engineer가 따를 것)
- **Bouncy 금지.** 스프링이 튀는 모션, exaggerated easing 금지. `ease-out` 위주, 길이는 600~1200ms.
- **Scroll-linked > scroll-triggered.** 한 번 트리거하고 끝나는 애니메이션보다, 스크롤 진행도에 묶인 모션이 매거진 톤에 맞다.
- **타이포가 모션의 주인공일 때가 많다.** 큰 헤드라인이 한 단어씩 페이드업, 작은 영문 캡션이 행간을 채우며 들어오는 식.
- **하나의 화면에 모션이 한두 개.** 동시에 여러 요소가 움직이지 않는다.

### 키 컬러
> **구현 현황(v4 'acid grid' 리디자인, 2026-07):** 실제 사이트 팔레트는 `globals.css`의 `@theme` 토큰이 **권위**다 — `acid #a9ff39` · `acid-deep #6faa0c` · `ink #121210` · `paper #fbfbf9` · `grey #8a8a82`. 신규 UI는 이 토큰을 쓴다. 아래 forest-green 탐색은 초기 방향 기록으로 남겨둔다(현행 아님).

- **Primary**: 짙은 초록 (제품병 컬러와 동일 톤). 실제 값은 제품 사진에서 샘플링해서 확정한다. 후보:
  - `#1A4D3A` (forest deep)
  - `#0F3D2E` (더 깊게)
  - `#1F5C42` (조금 밝게)
- **Background**: `#FFFFFF` 또는 미세한 따뜻한 화이트 (`#FAFAF7` 정도)
- **Text**: 거의 검정에 가까운 진한 회녹 — 순수 `#000`은 너무 강함. `#1A1A1A` 또는 키 그린의 가장 어두운 명도.
- **Accent / 보조**: 따뜻한 베이지/오프화이트 (제품컷 배경 톤). `#F2EDE4` 근처.

**규칙**: 짙은 초록은 강조용. 페이지를 초록으로 도배하지 않는다. 흰 바탕 위에 점·줄·작은 면적으로 등장할 때 가장 강하다.

**제품 이미지 주의**: 오너가 공유한 첫 번째 제품컷은 AI 생성 목업이다. **신뢰할 것은 두 가지뿐** — (1) 짙은 초록 컬러 톤, (2) 소문자 `suaci` 워드마크. 병의 라벨 텍스트("50ml", "DAILY PORTABLE MIST" 등)는 placeholder이므로 참조 금지. 실제 제품컷이 들어오면 `docs/references/`에 정리.

### 타이포그래피
- **한국어 본문**: Pretendard (이미 설치됨, AGENTS.md 참조). 행간 넉넉히 (1.7~1.8).
- **영문 캡션 / 헤드**: 산세리프 + 약간의 character. Archivo (현재 설치됨) 또는 더 매거진스러운 대안 검토 — 후보: Inter Display, GT America, Söhne (라이선스 별도), 무료라면 Manrope, Be Vietnam Pro, Geist.
- **숫자**: tabular-nums. 가격·용량·번호 라벨에서 정렬 깔끔하게.
- **소제목 영문은 종종 작게.** 본문 한국어보다 크기를 키우지 않는다.

### 레퍼런스 정책
- 오너가 무드컷·제품컷 레퍼런스를 추후 제공한다. 받으면 `docs/references/` 폴더에 정리하고, 이 문서에서 링크한다.
- 레퍼런스가 들어오기 전까지는 위 톤 정의를 가이드로 삼는다.

---

## 4. 사이트 구조 (커머스 샵)

홈은 매거진형, 그 위에 실제 커머스 라우트가 얹혀 있다. 전부 `src/app/[locale]/` 하위, `@/lib/api` seam에 배선(mock 동작).

```
/                         Home — 롱스크롤 매거진형 메인 (v4 acid grid)
/products                 상품 목록 (브랜드/카테고리 필터·커서 페이지네이션)
/products/[slug]          상품 상세(PDP) — 옵션 선택·담기·바로구매
/brands, /brands/[slug]   브랜드 목록·상세 (큐레이션)
/cart                     장바구니 (수량·삭제·합계)
/checkout                 체크아웃 (배송지 선택·주문요약·주문/결제)
/orders, /orders/[id]     주문 목록·상세 (취소·환불요청·환불내역)
/account                  계정 홈 (내정보·로그아웃·비번변경 진입)
/account/addresses        주소록 CRUD
/login, /signup           로그인·회원가입 (이메일 인증 포함)
/password/forgot, /reset  비밀번호 찾기·재설정
```

카피는 `docs/site-copy.md` 섹션 1, i18n는 `src/messages/{locale}.json` 참조. (구 계획의 `/story`·`/journal`은 아직 미구현.)

---

## 5. UI 요소 — 이제 mock으로 동작

기존 "동작 없는 쉘"에서 벗어나, 아래는 seam으로 **실제 동작**한다(배포 시 실백엔드로 스왑):

- **로그인 / 회원가입 / 비밀번호 재설정** — 백엔드 Cognito 계약대로 동작(mock 토큰 발급).
- **할인가 표시** (`정가 / 할인가 / 할인율`) — variant `price:{list,sale}`에서 파생, `@/lib/format`.
- **장바구니 / 체크아웃 / 주문·환불** — 담기 → 주문 → 결제(mock) → 취소/환불까지 상태 있게 동작.
- **언어**: **ko 고정, 언어 스위처 UI는 숨김.** i18n 인프라(5개 로케일)는 유지하되 전환 버튼은 노출하지 않는다. (오너 지시 2026-07-21)
- **이벤트 배너** (상단 라인 배너, 닫기 가능) — 유지.

**결제 주의**: 체크아웃 `confirmPayment`는 mock(`mockpay_…`)이다. 실 토스 결제위젯은 배포 후 교체(코드에 `// TODO(배포)` 마킹).

---

## 6. 스코프

### IN scope
- 위 1~5의 UI / 카피 / 모션 / 비주얼 + 커머스 페이지 전체
- **`@/lib/api` seam을 통한 백엔드 커머스 통합** — 지금은 mock 구현, 배포 후 http 구현으로 스왑. 타입(`src/types/*`)은 백엔드 DTO에 1:1.
- next-intl(ko 우선·스위처 숨김), 커서 페이지네이션, 이미지 최적화, 반응형·**모바일 우선**

### OUT of scope (지금 하지 말 것)
- 프론트에서 **직접** DB/ORM 접근, 자체 인증 라이브러리(NextAuth/Clerk/JWT 세션), 프론트 내 결제 로직 — 모두 백엔드(`../suaci-official-backend`) 책임. 프론트는 **seam 뒤로만** 호출한다.
- 관리자(admin) UI, LLM 연동
- 백엔드 자체 구현(별도 레포). 프론트 task 중 백엔드 **계약(DTO) 변경**이 필요하면 오너에게 보고.

> **주의**: 이 프로젝트는 "visual-first, 백엔드 없음" 단계를 지나 **커머스 통합 단계**로 이동했다. 과거의 "결제/인증/백엔드 task는 무조건 STOP" 규칙은 **더 이상 적용되지 않는다** — seam 경유 통합이 정식 스코프다.

---

## 7. 일하는 방식

0. **모델은 opus만.** 모든 `Agent` 디스패치(subagent / general-purpose / Explore 등)는 `model: "opus"`로 고정. 단순/기계적 작업처럼 보여도 haiku·sonnet 사용 금지. (오너 명시 — 2026-05-13)
1. **창의적 작업(새 페이지/섹션/기능)은 PM부터.** `pm` 에이전트를 디스패치해서 스펙을 받은 뒤 `frontend-engineer`로 넘긴다.
2. **순수 구현 task는 바로 `frontend-engineer`로.** 스펙이 명확하면 PM 단계 생략 가능.
3. **시각 작업에는 `frontend-design` 스킬을 반드시 쓴다.** Claude의 기본 미감으로 가면 generic해진다.
4. **AGENTS.md 컨벤션 엄수.** 코드 스타일·네이밍·import 순서·`@/i18n/navigation` Link 사용 등.
5. **검증 없이 완료 선언 금지.** 최소 `npx tsc --noEmit` · `pnpm lint` · `pnpm test` 통과. 시각 작업은 가능하면 dev server에서 **모바일 우선**으로 눈으로 확인.
6. **모바일 우선.** 오너가 데스크탑 디자인을 직접 담당한다(집에서 해옴). Claude는 **모바일 반응형을 책임**지고, 데스크탑 세부는 오너가 얹을 여지를 남긴다.
7. **작업 브랜치.** 기본은 페이즈별 브랜치 → 게이트 통과 후 main 머지. 단 오너가 "메인에서 해"라고 하면 브랜치 없이 main 직접 커밋도 허용(게이트는 동일).
8. **에이전트 위치.** `frontend-engineer`/`pm`은 이 레포 `.claude/agents/`와 `~/.claude/agents/`(유저 스코프) 양쪽에 있어 cwd 무관하게 잡힌다. 새로 설치한 에이전트는 **다음 세션부터** 등록된다.

---

## 8. 메모리 / 영구 컨텍스트

오너 선호, 과거 결정, 진행 중인 작업은 Claude Code memory에 저장되어 있다. 새 세션 시작 시 `MEMORY.md` (memory directory)에 있는 인덱스를 확인하면 도움이 된다. 특히:

- **삭제된 기능**: skin-check / 퍼스널 컬러 기능은 2026-05-10에 통째로 제거됨. 부활시키지 않는다.
- **병렬 에이전트**: 독립적 작업 2개 이상이면 한 메시지에서 병렬 디스패치가 기본값.

---

## 9. 빠른 참조

| 찾고 싶은 것 | 어디에 있나 |
|---|---|
| 코드 스타일·스택·네이밍 | `AGENTS.md` |
| 모든 페이지 카피 초안 | `docs/site-copy.md` |
| 브랜드 보이스 규칙 (단어 사전) | `docs/site-copy.md` 섹션 0 |
| 사이트 구조 | `docs/site-copy.md` 섹션 1, 본 문서 섹션 4 |
| 제품 데이터 | 홈용 `src/data/products.ts` · seam 픽스처 `src/data/fixtures/index.ts` |
| API seam (mock↔http 스왑) | `src/lib/api/` · DTO 타입 `src/types/` · 포맷 `src/lib/format.ts` |
| 인증/카트 컨텍스트 | `src/lib/auth/`, `src/lib/cart/` |
| 커머스 통합 설계/플랜 | `docs/superpowers/{specs,plans}/2026-07-20-*` |
| i18n 메시지 | `src/messages/{locale}.json` |
| 컴포넌트 | `src/components/{home,shell,ui,shop}/` |
| PM 에이전트 | `.claude/agents/pm.md` |
| 프론트엔드 엔지니어 에이전트 | `.claude/agents/frontend-engineer.md` |
| 디자인 레퍼런스 (예정) | `docs/references/` |

---

## 10. 확정 대기 (오너 답변 필요)

- [x] ~~**용량**~~ → **100ml 확정** (2026-07-21 정정; 구 80ml 표기 전부 정리)
- [ ] **정확한 키 컬러 hex** — AI 목업이 아닌 실제 제품 사진에서 샘플링
- [ ] **무드컷 / 제품컷 레퍼런스 이미지** 들어오면 `docs/references/`에 정리
- [ ] **할인 정책** (정가, 할인가, 할인율) — 마케팅 결정 후 정적 데이터에 반영
- [ ] **이벤트 배너 첫 메시지** — 무엇을 알릴지

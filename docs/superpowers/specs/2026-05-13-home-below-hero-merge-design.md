# Home: Below-Hero Section Merge — Design

**Date.** 2026-05-13
**Author.** brainstorming with Claude (Opus 4.7)
**Status.** Approved direction (Option A — Merge). Implementation pending.

---

## Why

홈페이지의 Hero / ProductFeature 다음에 이어지는 5개 섹션 (`Intro` · `Moments` · `Qualities` · `Story` · `Order`)이 다음 두 문제를 동시에 안고 있다:

1. **Thin content** — 각 섹션이 실제 정보량 대비 차지하는 화면 면적이 크다 (특히 `Intro`: 거대 헤드라인 + 3개 카드 + 클로징 + 풀 라인 + 필드 노트 사진).
2. **Thematic overlap** — `Intro`(문제 제기)과 `Story`(브랜드 답)이 같은 "브랜드 철학"을 두 번 다룬다. `Moments`(언제)와 `Qualities`(무엇)는 둘 다 "제품 속성"을 4-카드 그리드로 반복.

오너 피드백: "여기부터 밑에까지 별내용도 없는데 자리를 너무 차지하고 깔끔하지도 않다."

## Decision

**5 → 3 섹션으로 통합.** 같은 주제끼리 합쳐 thin content를 해소하고 페이지 길이를 줄인다.

| 이전 | 이후 |
|---|---|
| `IntroSection` + `StorySection` | **`BrandNoteSection`** |
| `MomentsSection` + `QualitiesSection` | **`ProductNotesSection`** |
| `OrderSection` | `OrderSection` (변경 없음) |

페이지 전체 구조 (`src/app/[locale]/page.tsx`) 이후:

```
Hero
ProductFeature
BrandNoteSection       ← 신규 (Intro + Story 통합)
ProductNotesSection    ← 신규 (Moments + Qualities 통합)
OrderSection           ← 기존 유지
Footer
```

---

## Sections — Concrete Design

### 1. `BrandNoteSection` (신규)

**파일**: `src/components/sections/BrandNoteSection.tsx`
**대체**: `IntroSection.tsx`, `StorySection.tsx`
**i18n 네임스페이스**: `brandNote` (신규)

**구조 (위에서 아래, 중앙 정렬 매거진 톤):**

```
[ No.02 — Brand Note ]
─────────────────────────────────────

피부는 매일, 조금씩 흔들립니다.
좋아질 시간보다, 나빠질 순간이 더 자주.

   ── suaci · brand note ──

         좋아지게 만들지 않습니다.

      좋아지게 하지 않습니다.
      덜 무너지게 합니다.

      자극이 닿기 전에, 한 번.
      닿은 뒤에, 다시 한 번.

│ 01 매일 쓸 수 있을 것  │ 02 가방 안에 들어갈 것  │ 03 약속을 줄일 것 │
─────────────────────────────────────
```

**구성 요소 (순서대로):**

1. **Section eyebrow** — `<SectionEyebrow number="No.02" label="Brand Note" />`, 중앙 inline-flex.
2. **Problem statement** — 2줄 짧은 한국어. (Intro의 3개 problem 카드 + 거대 헤드라인을 압축한 결과.)
   - 폰트: `font-serif font-light text-[clamp(20px,2.4vw,28px)]`
   - max-w-[28ch], 중앙 정렬
3. **Signature divider** — `── suaci · brand note ──`, EN small, uppercase, 짙은 초록.
4. **Manifesto headline (one line)** — "좋아지게 만들지 않습니다."
   - 큰 명조: `font-serif font-light text-[clamp(34px,4.4vw,64px)]`
   - 텍스트의 핵심 동사를 짙은 초록 강조.
5. **Manifesto pull (dotted-bordered, two paragraphs)** — Story의 manifesto 2단락 유지.
   - 위아래 dotted border-y, 짙은 초록 텍스트
   - `max-w-[46ch]` 중앙
6. **3 principles row** — 3등분 grid, dotted divider, 각 셀에 큰 번호 + 한국어 원칙.
   - `PrincipleCell` 하위 컴포넌트 그대로 (StorySection에서 이식).

**드롭하는 요소:**
- Intro 상단 meta row (`No.01 — Why we made this` / `Field — Skin care, calming`)
- Intro의 3개 problem 카드 (큰 italic 숫자 + 1줄 본문 × 3) → 위 2줄 statement로 압축
- Intro의 editorial pull 라인 3개
- Intro의 field note 사진 (`ref-khaki.jpg`) + 4줄 텍스트 — **가장 무거운 시각 요소, 통째 제거**
- Story의 wishlist 사진 (`ref-wishlist.jpg`) + 캡션 — 페이지 다른 곳(Hero, ProductFeature)에 이미 큰 사진이 있어 중복

**높이 추정 (desktop):**
- 기존 Intro + Story = ~1800px
- 신규 BrandNote = ~700-800px (60% 감소)

---

### 2. `ProductNotesSection` (신규)

**파일**: `src/components/sections/ProductNotesSection.tsx`
**대체**: `MomentsSection.tsx`, `QualitiesSection.tsx`
**i18n 네임스페이스**: `productNotes` (신규)

**구조:**

```
[ No.03 — Product Notes ]
─────────────────────────────────────

언제, 그리고 무엇이.
Field & form.

┌───────────────────────────┬──────────────────────────┐
│ When                       │ What                     │
│                            │                          │
│ 01  Indoor / 실내          │ 01  수분 진정             │
│     냉방과 난방을 오가는...│     Hydrating calm        │
│                            │     예민해진 피부 결을...│
│ 02  On makeup / 화장 위    │                          │
│     당김, 답답함, 들뜸...  │ 02  약산성                │
│                            │     Mildly acidic         │
│ 03  Outdoor / 외부         │     피부와 닮은 pH...     │
│     땀, 햇빛, 마찰...      │                          │
│                            │ 03  휴대성                │
│ 04  Minimal / 간결한 루틴  │     Portable              │
│     가방 안에 하나...      │     가방 안에서 자리를... │
│                            │                          │
│                            │ 04  열감 케어             │
│                            │     Cooling touch         │
│                            │     뜨거워진 피부 위에... │
└───────────────────────────┴──────────────────────────┘
```

**구성 요소:**

1. **Section eyebrow + 헤드라인 + EN sub** — Moments/Qualities와 동일한 3-col grid 패턴 재사용:
   - `<SectionEyebrow number="No.03" label="Product Notes" />`
   - 헤드 한국어 (2줄): "언제, 그리고 / 무엇이."
   - EN sub 우측: "Field & form. / When and what."
2. **2 sub-columns (desktop) / stacked (mobile)** — `grid grid-cols-2 gap-x-[80px]`, 768px 이하 1열.
3. **When 컬럼** — 4 moments, 텍스트만:
   - 각 row: `01-04 번호 + Indoor 태그 + "/ 실내" + 3줄 한국어 body`
   - dotted divider 사이사이
   - **사진 없음** (Moments의 4 이미지 통째 드롭)
4. **What 컬럼** — 4 qualities, 현재 `QualitiesSection`의 2x2 인덱스 패턴을 1-column으로:
   - 각 row: `01-04 번호 + KR 제목 + EN 라벨 + 1줄 description`
   - dotted divider 사이사이

**드롭하는 요소:**
- Moments의 4 이미지 (`ref-reading.jpg`, `ref-puffer.jpg`, `ref-walking-coat.jpg`, `ref-walking-white.jpg`)
- Moments의 `M01-M04` 번호 라벨 (이미 좌측 번호 01-04로 대체)
- Moments의 figure 캡션
- Moments의 카드 hover scale 모션 (이미지 없으니 불필요)

**높이 추정 (desktop):**
- 기존 Moments + Qualities = ~1400px
- 신규 ProductNotes = ~600-700px (50% 감소)

---

### 3. `OrderSection`

**변경 없음.** 이미 적당히 압축되어 있고, CTA 역할이 명확함.

---

## i18n 처리

**신규 키 추가 (5개 로케일):**

```jsonc
"brandNote": {
  "eyebrowNumber": "No.02",
  "eyebrowLabel": "Brand Note",
  "problemLine1": "피부는 매일, 조금씩 흔들립니다.",
  "problemLine2": "좋아질 시간보다, 나빠질 순간이 더 자주.",
  "signature": "── suaci · brand note",
  "manifestoHeadline1": "좋아지게 만들지",
  "manifestoHeadlineHighlight": "않습니다.",
  "manifesto1": "좋아지게 하지 않습니다.",
  "manifesto2": "덜 무너지게 합니다.",
  "manifesto3": "자극이 닿기 전에, 한 번.",
  "manifesto4": "닿은 뒤에, 다시 한 번.",
  "principle1Number": "01",
  "principle1": "매일 쓸 수 있을 것.",
  "principle2Number": "02",
  "principle2": "가방 안에 들어갈 것.",
  "principle3Number": "03",
  "principle3": "약속을 줄일 것."
},
"productNotes": {
  "eyebrowNumber": "No.03",
  "eyebrowLabel": "Product Notes",
  "headline1": "언제, 그리고",
  "headline2": "무엇이.",
  "enSub1": "Field & form.",
  "enSub2": "When and what.",
  "whenLabel": "When",
  "whatLabel": "What",
  /* When (4 moments) — 기존 moments.* 와 동일 텍스트, 키만 재구성 */
  "when1Tag": "Indoor",
  "when1Kr": "/ 실내",
  "when1Body": "냉방과 난방을 오가는 사이, 피부가 먼저 마릅니다. 책상 위에 두고, 한 번씩.",
  /* ... when2~4 ... */
  /* What (4 qualities) — 기존 qualities.* 와 동일 */
  "what1Title": "수분 진정",
  "what1En": "Hydrating calm",
  "what1Desc": "예민해진 피부 결을 차분히 가라앉히는 보습 베이스.",
  /* ... what2~4 ... */
}
```

**Orphan 처리:** 기존 `intro`, `moments`, `qualities`, `story` 네임스페이스 키는 **남겨둔다.** 이번 변경에서는 신규 키만 추가하고, 기존 키 정리는 별도 i18n 재구성 패스에서. (다른 페이지에서 재사용 가능성도 있음.)

**5개 로케일 모두 ko 텍스트 미러링.** 영어/일본어/중국어/태국어 번역은 별도 작업.

---

## 파일 변경 요약

**신규 (3):**
- `src/components/sections/BrandNoteSection.tsx`
- `src/components/sections/ProductNotesSection.tsx`
- `src/messages/{ko,en,ja,zh,th}.json` — `brandNote`, `productNotes` 네임스페이스 추가

**수정 (1):**
- `src/app/[locale]/page.tsx` — Intro/Moments/Qualities/Story import 제거, BrandNote/ProductNotes 추가.

**보존 (4):**
- `src/components/sections/IntroSection.tsx`
- `src/components/sections/MomentsSection.tsx`
- `src/components/sections/QualitiesSection.tsx`
- `src/components/sections/StorySection.tsx`

→ 페이지에서 import만 빼고 파일은 남긴다. 다른 페이지(예: 미래의 `/story`)에서 재사용 가능. 명백히 dead code라 판단될 때 별도 패스에서 정리.

---

## Out of Scope (이번 작업에서 안 함)

- Hero / ProductFeature 변경
- Header / Footer 변경
- 다국어 번역 (en/ja/zh/th)
- 기존 `intro`, `moments`, `qualities`, `story` i18n 키 정리
- 새로운 사진/이미지 추가
- 모션 새로 추가 (기존 reveal · in 그대로 활용)
- 백엔드 / DB / auth 등 인프라 (현재 단계 OUT of scope 유지)

---

## Acceptance Criteria

1. 홈페이지 Hero/ProductFeature 다음에 정확히 **3개 섹션**(BrandNote, ProductNotes, Order)만 렌더링됨.
2. `npx tsc --noEmit` exit 0.
3. `pnpm lint` 새 코드에서 에러 0.
4. 모든 핵심 카피 보존:
   - ✅ "피부는 매일, 조금씩 흔들립니다." (의미 압축됨)
   - ✅ "좋아지게 만들지 않습니다." (그대로)
   - ✅ Manifesto 2단락 (그대로)
   - ✅ 3 principles (그대로)
   - ✅ 4 moments (텍스트 그대로, 이미지 제거)
   - ✅ 4 qualities (그대로)
5. 페이지 전체 길이 (Hero/Footer 제외) 약 **40-50% 감소** (1400+1800 → 700+700 = 약 2300px 감소).
6. 매거진 톤(흰 바탕, 짙은 초록 강조, dotted divider, 영문 캡션) 유지.
7. `SectionEyebrow`, `SECTION_PADDING_Y` 등 기존 프리미티브 일관 사용.
8. 모바일(≤768px) 1열 stack 동작.

---

## Open Questions (구현 중 결정)

- BrandNote의 manifesto pull과 principles 사이 간격 — Story 현재 값(`mt-[96px]`) 유지 vs 더 좁힘.
- ProductNotes에서 When/What 컬럼 사이 vertical divider 추가 여부 — 디자인 톤상 dotted line이 있는 게 자연스러우면 추가.
- 모바일에서 When/What 순서 — When 먼저 (사용 시나리오 → 무엇인지) 추천.

---

## Next Step

→ 이 spec 오너 승인 후 → `superpowers:writing-plans` 스킬로 구현 계획 작성 → 실제 컴포넌트 작성.

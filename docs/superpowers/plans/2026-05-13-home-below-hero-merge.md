# Home: Below-Hero Section Merge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hero/ProductFeature 다음의 5개 섹션(`Intro`·`Moments`·`Qualities`·`Story`·`Order`)을 3개(`BrandNote`·`ProductNotes`·`Order`)로 통합해 thin content와 thematic overlap을 해소하고 페이지를 ~40-50% 단축한다.

**Architecture:** 기존 컴포넌트 파일은 보존하고(import만 제거) 새 컴포넌트 2개(`BrandNoteSection`, `ProductNotesSection`)를 추가해 `src/app/[locale]/page.tsx`의 렌더 순서만 교체한다. i18n은 새 네임스페이스(`brandNote`, `productNotes`)를 추가하는 식으로 진행하고 기존 키는 그대로 둔다 (이후 i18n 정리 패스 별도).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, next-intl v4. 테스트 프레임워크 없음 → 검증은 `npx tsc --noEmit` + `pnpm lint` + 브라우저 시각 확인.

**Spec:** `docs/superpowers/specs/2026-05-13-home-below-hero-merge-design.md`

---

## File Structure

**Create (2):**
- `src/components/sections/BrandNoteSection.tsx` — Intro+Story 통합. eyebrow + 압축된 problem 2줄 + signature + manifesto 헤드라인 + dotted-bordered manifesto pull + 3 principles.
- `src/components/sections/ProductNotesSection.tsx` — Moments+Qualities 통합. 2-col (When | What), 사진 4개 통째로 제거.

**Modify (6):**
- `src/messages/ko.json` — `brandNote`, `productNotes` 네임스페이스 추가.
- `src/messages/en.json`, `src/messages/ja.json`, `src/messages/zh.json`, `src/messages/th.json` — 동일 내용 미러링 (한국어 그대로, 번역은 별도 작업).
- `src/app/[locale]/page.tsx` — Intro/Moments/Qualities/Story import 제거, BrandNote/ProductNotes 추가.

**Preserve (4 files untouched):**
- `src/components/sections/IntroSection.tsx`
- `src/components/sections/MomentsSection.tsx`
- `src/components/sections/QualitiesSection.tsx`
- `src/components/sections/StorySection.tsx`

---

## Task 1: i18n 키 추가 — ko.json

**Files:**
- Modify: `src/messages/ko.json`

- [ ] **Step 1: 파일을 열어 마지막 closing `}` 직전(`"cart": { ... }` 다음) 위치 확인**

Read `src/messages/ko.json` 끝부분을 보고 `"cart": { ... }` 닫힘과 파일 전체 `}` 위치를 확인.

- [ ] **Step 2: `cart` 객체 다음에 `brandNote`, `productNotes` 객체를 삽입**

기존 `"cart": { ... }` 닫는 `}` 뒤에 콤마와 두 개 객체 추가. 파일 전체 끝나는 `}` 위에 들어가야 함.

추가할 정확한 JSON:

```json
,
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
    "when1Tag": "Indoor",
    "when1Kr": "/ 실내",
    "when1Body": "냉방과 난방을 오가는 사이, 피부가 먼저 마릅니다. 책상 위에 두고, 한 번씩.",
    "when2Tag": "On Makeup",
    "when2Kr": "/ 화장 위",
    "when2Body": "당김, 답답함, 들뜸. 지우지 않고도 가라앉힐 수 있도록, 화장 위에 가볍게 한 번.",
    "when3Tag": "Outdoor",
    "when3Kr": "/ 외부",
    "when3Body": "땀, 햇빛, 마찰. 열감이 가시기 전, 얼굴 위로 가만히 뿌려둡니다.",
    "when4Tag": "Minimal",
    "when4Kr": "/ 간결한 루틴",
    "when4Body": "가방 안에 하나. 무거운 케어 대신, 한 번의 미스트로 하루의 마침표를 찍습니다.",
    "what1Title": "수분 진정",
    "what1En": "Hydrating calm",
    "what1Desc": "예민해진 피부 결을 차분히 가라앉히는 보습 베이스.",
    "what2Title": "약산성",
    "what2En": "Mildly acidic",
    "what2Desc": "피부와 닮은 pH 영역에서, 매일 써도 무겁지 않게.",
    "what3Title": "휴대성",
    "what3En": "Portable",
    "what3Desc": "가방 안에서 자리를 차지하지 않는 80ml 사이즈.",
    "what4Title": "열감 케어",
    "what4En": "Cooling touch",
    "what4Desc": "뜨거워진 피부 위에 가볍게 내려앉도록."
  }
```

위 블록의 첫 글자 `,`는 기존 `cart` 객체의 닫는 `}` 뒤에 붙는 콤마임. 들여쓰기 2-space 유지.

- [ ] **Step 3: JSON 유효성 확인**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/messages/ko.json', 'utf8')); console.log('valid')"`
Expected: `valid` 출력. 에러나면 콤마 빠짐/오타 검사 후 수정.

- [ ] **Step 4: 커밋**

```bash
git add src/messages/ko.json
git commit -m "feat(i18n): brandNote/productNotes ko 네임스페이스 추가"
```

---

## Task 2: i18n 키 미러링 — en/ja/zh/th

**Files:**
- Modify: `src/messages/en.json`
- Modify: `src/messages/ja.json`
- Modify: `src/messages/zh.json`
- Modify: `src/messages/th.json`

> 이번 단계에서는 한국어 텍스트를 그대로 미러링한다 (Korean-first 단계). 실제 번역은 별도 i18n 작업으로 분리.

- [ ] **Step 1: ko.json에서 brandNote와 productNotes 객체를 그대로 복사**

방금 Task 1에서 추가한 `brandNote: { ... }`와 `productNotes: { ... }` 두 블록을 통째로 클립보드에.

- [ ] **Step 2: en.json에 같은 위치에 삽입**

`src/messages/en.json`을 열고, ko.json과 동일한 위치(`"cart": { ... }` 객체 다음, 파일 끝 `}` 직전)에 같은 두 객체를 콤마로 연결해 삽입. 내용은 한국어 그대로.

- [ ] **Step 3: ja.json에 동일하게 삽입**

- [ ] **Step 4: zh.json에 동일하게 삽입**

- [ ] **Step 5: th.json에 동일하게 삽입**

- [ ] **Step 6: 5개 파일 JSON 유효성 일괄 확인**

Run:
```bash
for f in src/messages/{ko,en,ja,zh,th}.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f','utf8')); console.log('$f valid')" || echo "$f INVALID"
done
```
Expected: 5줄 모두 `... valid`.

- [ ] **Step 7: 커밋**

```bash
git add src/messages/en.json src/messages/ja.json src/messages/zh.json src/messages/th.json
git commit -m "feat(i18n): mirror brandNote/productNotes to en/ja/zh/th"
```

---

## Task 3: BrandNoteSection 컴포넌트 생성

**Files:**
- Create: `src/components/sections/BrandNoteSection.tsx`

- [ ] **Step 1: 파일 생성**

`src/components/sections/BrandNoteSection.tsx`에 다음 내용을 정확히 그대로 작성한다.

```tsx
import { useTranslations } from "next-intl";
import { SECTION_PADDING_Y_LG, SHELL } from "@/constants/site";
import SectionEyebrow from "@/components/ui/SectionEyebrow";

/**
 * Brand Note — Intro + Story 통합 섹션.
 *
 * 구조 (중앙 정렬 매거진 톤):
 *   eyebrow → problem statement (2줄) → signature → manifesto headline
 *   → manifesto pull (dotted-bordered 2단락) → 3 principles row
 *
 * `id="story"`는 기존 푸터/헤더의 `/#story` 앵커 호환용.
 */
export default function BrandNoteSection() {
  const t = useTranslations("brandNote");

  return (
    <section
      id="story"
      className={`brand-note ${SECTION_PADDING_Y_LG} border-t border-line text-center bg-background`}
    >
      <div className={SHELL}>
        <div className="reveal inline-flex justify-center mb-[40px]">
          <SectionEyebrow number={t("eyebrowNumber")} label={t("eyebrowLabel")} />
        </div>

        <p className="reveal font-serif font-light text-[clamp(20px,2.4vw,28px)] leading-[1.55] text-ink-soft max-w-[28ch] mx-auto m-0 max-md:text-[18px]">
          {t("problemLine1")}
          <br />
          {t("problemLine2")}
        </p>

        <div className="reveal mt-[36px] font-en text-[11px] tracking-[0.22em] uppercase text-ink-mute">
          {t("signature")}
        </div>

        <h2 className="reveal mt-[48px] font-normal text-[clamp(34px,4.4vw,64px)] leading-[1.32] tracking-[-0.02em] text-balance max-w-[18ch] mx-auto text-ink m-0 max-md:text-[32px]">
          {t("manifestoHeadline1")}{" "}
          <span className="text-green">{t("manifestoHeadlineHighlight")}</span>
        </h2>

        <div className="reveal mx-auto mt-[64px] max-w-[46ch] text-center font-serif font-light text-[clamp(22px,2.2vw,28px)] leading-[1.7] text-green tracking-[-0.005em] border-t border-b border-dotted border-line py-[24px] max-md:text-[18px] max-md:mt-[48px] max-md:px-[18px]">
          <p className="m-0 mb-[1em]">
            {t("manifesto1")}
            <br />
            {t("manifesto2")}
          </p>
          <p className="m-0">
            {t("manifesto3")}
            <br />
            {t("manifesto4")}
          </p>
        </div>

        <div className="reveal mx-auto mt-[72px] max-w-[880px] grid grid-cols-3 border-t border-green border-b border-line max-md:grid-cols-1 max-md:mt-[48px]">
          <PrincipleCell n={t("principle1Number")} text={t("principle1")} />
          <PrincipleCell n={t("principle2Number")} text={t("principle2")} />
          <PrincipleCell n={t("principle3Number")} text={t("principle3")} last />
        </div>
      </div>
    </section>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface PrincipleCellProps {
  n: string;
  text: string;
  last?: boolean;
}

function PrincipleCell({ n, text, last }: PrincipleCellProps) {
  return (
    <div
      className={`px-[28px] py-[36px] text-left ${
        last
          ? ""
          : "border-r border-dotted border-line max-md:border-r-0 max-md:border-b max-md:border-line"
      } max-md:py-[22px] max-md:px-0`}
    >
      <span className="font-en font-light text-[36px] text-green leading-none tracking-[-0.02em] block mb-[18px]">
        {n}
      </span>
      <h4 className="font-serif font-normal text-[18px] tracking-[-0.01em] text-ink leading-[1.4] m-0">
        {text}
      </h4>
    </div>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: exit 0. 에러나면 코드 오타 / import 누락 확인.

- [ ] **Step 3: 린트**

Run: `pnpm lint`
Expected: 새 파일 관련 에러 0.

- [ ] **Step 4: 커밋**

```bash
git add src/components/sections/BrandNoteSection.tsx
git commit -m "feat(home): add BrandNoteSection (Intro+Story 통합)"
```

---

## Task 4: ProductNotesSection 컴포넌트 생성

**Files:**
- Create: `src/components/sections/ProductNotesSection.tsx`

- [ ] **Step 1: 파일 생성**

`src/components/sections/ProductNotesSection.tsx`에 다음 내용을 정확히 그대로 작성한다.

```tsx
import { useTranslations } from "next-intl";
import { SECTION_PADDING_Y, SHELL } from "@/constants/site";
import SectionEyebrow from "@/components/ui/SectionEyebrow";

/**
 * Product Notes — Moments + Qualities 통합 섹션.
 *
 * 2-col 그리드 (desktop) / 1-col stack (mobile).
 * 좌측 When: 4 사용 시나리오 (텍스트 only — 사진 통째로 제거).
 * 우측 What: 4 제품 속성.
 */

interface WhenItem {
  n: string;
  tagKey: string;
  krKey: string;
  bodyKey: string;
}

const WHEN_ITEMS: WhenItem[] = [
  { n: "01", tagKey: "when1Tag", krKey: "when1Kr", bodyKey: "when1Body" },
  { n: "02", tagKey: "when2Tag", krKey: "when2Kr", bodyKey: "when2Body" },
  { n: "03", tagKey: "when3Tag", krKey: "when3Kr", bodyKey: "when3Body" },
  { n: "04", tagKey: "when4Tag", krKey: "when4Kr", bodyKey: "when4Body" },
];

interface WhatItem {
  n: string;
  titleKey: string;
  enKey: string;
  descKey: string;
}

const WHAT_ITEMS: WhatItem[] = [
  { n: "01", titleKey: "what1Title", enKey: "what1En", descKey: "what1Desc" },
  { n: "02", titleKey: "what2Title", enKey: "what2En", descKey: "what2Desc" },
  { n: "03", titleKey: "what3Title", enKey: "what3En", descKey: "what3Desc" },
  { n: "04", titleKey: "what4Title", enKey: "what4En", descKey: "what4Desc" },
];

export default function ProductNotesSection() {
  const t = useTranslations("productNotes");

  return (
    <section className={`product-notes ${SECTION_PADDING_Y} border-t border-line`}>
      <div className={SHELL}>
        <div className="grid grid-cols-[160px_1fr_1fr] gap-[48px] items-end mb-[64px] max-md:grid-cols-1 max-md:gap-[18px] max-md:mb-[36px]">
          <SectionEyebrow number={t("eyebrowNumber")} label={t("eyebrowLabel")} />
          <h2 className="reveal font-normal text-[clamp(28px,3.4vw,46px)] leading-[1.25] tracking-[-0.015em] text-balance max-w-[14ch] max-md:text-[28px]">
            {t("headline1")}
            <br />
            {t("headline2")}
          </h2>
          <div className="reveal font-en text-[13px] tracking-[0.04em] text-ink-mute leading-[1.65] self-end max-w-[30ch]">
            {t("enSub1")}
            <br />
            {t("enSub2")}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-[80px] border-t border-line max-md:grid-cols-1 max-md:gap-0">
          <div className="reveal border-r border-dotted border-line pr-[48px] max-md:border-r-0 max-md:pr-0 max-md:border-b max-md:border-line max-md:pb-[24px] max-md:mb-[16px]">
            <h3 className="font-en text-[11px] tracking-[0.22em] uppercase text-green pt-[28px] pb-[16px] border-b border-dotted border-line mb-[8px]">
              {t("whenLabel")}
            </h3>
            {WHEN_ITEMS.map((item, idx) => (
              <div
                key={item.n}
                className={`grid grid-cols-[40px_1fr] gap-[18px] py-[22px] items-start ${
                  idx < WHEN_ITEMS.length - 1
                    ? "border-b border-dotted border-line"
                    : ""
                }`}
              >
                <span className="num font-en text-[13px] tracking-[0.04em] text-green font-medium pt-[2px]">
                  {item.n}
                </span>
                <div>
                  <div className="flex items-baseline gap-[10px] mb-[10px] font-en text-[11px] tracking-[0.18em] uppercase text-green flex-wrap">
                    <span>{t(item.tagKey)}</span>
                    <span className="font-sans normal-case tracking-normal text-[12px] text-ink-mute">
                      {t(item.krKey)}
                    </span>
                  </div>
                  <p className="text-ink-soft text-[15px] leading-[1.8] max-w-[32ch] m-0">
                    {t(item.bodyKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="reveal pl-[48px] max-md:pl-0">
            <h3 className="font-en text-[11px] tracking-[0.22em] uppercase text-green pt-[28px] pb-[16px] border-b border-dotted border-line mb-[8px]">
              {t("whatLabel")}
            </h3>
            {WHAT_ITEMS.map((item, idx) => (
              <div
                key={item.n}
                className={`grid grid-cols-[40px_1fr] gap-[18px] py-[22px] items-start ${
                  idx < WHAT_ITEMS.length - 1
                    ? "border-b border-dotted border-line"
                    : ""
                }`}
              >
                <span className="num font-en text-[13px] tracking-[0.04em] text-green font-medium pt-[4px]">
                  {item.n}
                </span>
                <div>
                  <h4 className="font-normal text-[19px] leading-[1.45] tracking-[-0.01em] flex items-baseline gap-[14px] flex-wrap mb-[8px]">
                    {t(item.titleKey)}
                    <span className="font-en text-[11px] tracking-[0.06em] text-ink-mute uppercase">
                      {t(item.enKey)}
                    </span>
                  </h4>
                  <p className="text-ink-soft text-[15px] leading-[1.8] max-w-[32ch] m-0">
                    {t(item.descKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: 린트**

Run: `pnpm lint`
Expected: 새 파일 관련 에러 0.

- [ ] **Step 4: 커밋**

```bash
git add src/components/sections/ProductNotesSection.tsx
git commit -m "feat(home): add ProductNotesSection (Moments+Qualities 통합)"
```

---

## Task 5: 홈 페이지 import 교체 + 최종 검증

**Files:**
- Modify: `src/app/[locale]/page.tsx`

- [ ] **Step 1: page.tsx 전체를 다음 내용으로 교체**

```tsx
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import ProductFeatureSection from "@/components/sections/ProductFeatureSection";
import BrandNoteSection from "@/components/sections/BrandNoteSection";
import ProductNotesSection from "@/components/sections/ProductNotesSection";
import OrderSection from "@/components/sections/OrderSection";
import RevealOnScroll from "@/components/ui/RevealOnScroll";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <ProductFeatureSection />
        <BrandNoteSection />
        <ProductNotesSection />
        <OrderSection />
      </main>
      <Footer />
      <RevealOnScroll />
    </>
  );
}
```

차이점: `IntroSection`, `MomentsSection`, `QualitiesSection`, `StorySection` import 4줄 제거. `BrandNoteSection`, `ProductNotesSection` import 2줄 추가. `<main>` 안 5개 → 5개로 동일하지만 내용물이 바뀜.

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: 린트**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: dev 서버 띄워서 컴파일 에러 없는지 확인**

이 단계는 백그라운드로 dev 서버 띄우고 1-2초 후 로그 확인.

Run (background): `pnpm dev`
Wait 3 seconds.
Then check first page compile:
Run: `curl -sI http://localhost:3000 | head -1`
Expected: `HTTP/1.1 200 OK`.

문제 없으면 `pkill -f "next dev"` 로 정리.

- [ ] **Step 5: 커밋**

```bash
git add src/app/[locale]/page.tsx
git commit -m "feat(home): swap Intro/Moments/Qualities/Story → BrandNote/ProductNotes"
```

- [ ] **Step 6: 변경 요약 푸시 안내**

오너에게 알림:
- 5 → 3 섹션 통합 완료
- 4개 커밋 (i18n ko / i18n 미러 / BrandNoteSection / ProductNotesSection / page swap = 실제로는 5 커밋)
- `pnpm dev`로 직접 시각 확인 요청
- 푸시 여부 오너 결정

---

## Self-Review Notes

**Spec coverage 매핑:**
- Spec §1 BrandNoteSection → Task 3 ✅
- Spec §2 ProductNotesSection → Task 4 ✅
- Spec §3 OrderSection 유지 → 변경 없음, 작업 불필요 ✅
- Spec i18n 처리 (신규 키 추가 + 기존 키 orphan) → Task 1, 2 ✅
- Spec 파일 변경 요약 (신규 2, 수정 1+5) → Task 1, 2, 3, 4, 5 ✅
- Spec "보존" (Intro/Moments/Qualities/Story 파일 삭제 안 함) → 어떤 task에서도 삭제 안 함 ✅
- Spec Acceptance Criteria → Task 5 Step 2~4가 검증 ✅

**Placeholder 검사:** "TBD", "TODO", "implement later", "추후 처리" 등의 표현 없음. 모든 코드 블록은 그대로 붙여넣을 수 있는 완성 상태.

**Type/시그니처 일관성:**
- `useTranslations("brandNote")`, `useTranslations("productNotes")` — Task 1, 2의 ko.json 네임스페이스와 일치 ✅
- `SECTION_PADDING_Y`, `SECTION_PADDING_Y_LG`, `SHELL` — `src/constants/site.ts`에 이미 존재 (이전 리팩토링에서 추가) ✅
- `SectionEyebrow` props (`number`, `label`) — 기존 component 시그니처와 일치 ✅
- `PrincipleCell` — Task 3 안에서 local 컴포넌트로 정의 + 사용, signature 일치 ✅
- i18n 키 이름이 컴포넌트의 `t(...)` 호출과 정확히 매칭:
  - brandNote: eyebrowNumber/Label, problemLine1/2, signature, manifestoHeadline1/Highlight, manifesto1~4, principle1~3 (Number + text) ✅
  - productNotes: eyebrowNumber/Label, headline1/2, enSub1/2, whenLabel/whatLabel, when1~4 (Tag/Kr/Body), what1~4 (Title/En/Desc) ✅

**Open question (구현 중 결정):**
- BrandNote의 manifesto pull과 principles 사이 간격 — Task 3에서 `mt-[72px]` (Story의 `mt-[96px]`보다 좁힘). 시각 확인 후 조정 가능.
- ProductNotes 모바일에서 When/What 순서 — 위(When) → 아래(What), 컴포넌트 markup 순서 그대로 따름.

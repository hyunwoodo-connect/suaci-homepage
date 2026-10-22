# AGENTS.md

사람과 코딩 에이전트가 같이 따르는 코드 규칙. 자주 안 바뀌는 기본만 둔다.

## Commands

| Command                  | Description           |
| ------------------------ | --------------------- |
| `pnpm install`           | Install dependencies  |
| `pnpm dev`               | Dev server            |
| `pnpm build`             | Production build      |
| `pnpm lint`              | ESLint                |
| `pnpm exec tsc --noEmit` | Type check (strict)   |
| `pnpm test`              | Vitest (jsdom)        |
| `pnpm format`            | Prettier — write      |
| `pnpm format:check`      | Prettier — check only |

**Done = `pnpm format:check` · `pnpm lint` · `pnpm exec tsc --noEmit` · `pnpm test` all pass.** CI runs the same on every PR.

Node version is pinned in `.nvmrc`. Env vars: copy `.env.example` to `.env.local`.

## Stack

Next.js (App Router) · React · TypeScript strict · Tailwind CSS v4 · next-intl · Vitest · pnpm. Path alias `@/*` → `./src/*`.

## Structure

- `src/activities/` — the activity registry (`index.ts`, `getActivity`) plus one module per activity (`take-four/`). An event record's `activityId` picks the module. Modules never import each other; shared code goes up to `src/lib/` or `src/components/`.
- `src/events/` — per-event content (`getEventContent(eventId)`): the parts of an event not yet on the backend record. The shared type (`EventContent`) holds only what every event has (`activityId`, `label`); each activity defines the extra content it reads (e.g. `TakeFourEventContent` in `take-four/eventContent.ts`) and the event module `satisfies` it — events depend on activities, not the reverse. Activities read event-specific text from here, never hard-code it.

## Boundaries

- All data access goes through `@/lib/api`. Pages and components never call `fetch` for app data directly.
- `src/types/` mirrors backend DTOs. Don't change a DTO shape on the frontend alone.
- **Exception — activity-owned endpoints** (`/activities/{id}/…`): the client and its DTOs live inside that activity module (e.g. `take-four/wall/api.ts`), so the module stays self-contained. It imports only the public pieces from `@/lib/api` (`createFetcher`, `Envelope`, `ApiClientError`, `isNotFound`, `isRateLimited`, `selectApi`), never `@/lib/api/http/*` or other internals.
- Event and activity APIs pick their implementation with `selectApi` (backend URL set → live; no URL → mock in dev/test, empty in production — production never serves mock data). Mocks live in their own files (`lib/api/mock/events.ts`, `take-four/wall/mockApi.ts`). The commerce `api` is separate and uses `NEXT_PUBLIC_API_MODE`.
- No auth library, DB access, or payment logic in this repo — that is the backend's job.
- Don't add code "for later" (YAGNI). Unused exports, methods, locales, and dependencies get deleted.

## Formatting

Prettier owns formatting (`.prettierrc.json`): 2 spaces, double quotes, semicolons, trailing commas, 100 columns. Don't hand-format; run `pnpm format`.

## Imports

Groups, separated by a blank line:

1. `"use client"` (first line, only if needed)
2. `react`, `react-dom`
3. Framework / third-party (`next/*`, `next-intl`)
4. Internal aliases (`@/...`)
5. Relative (`./`, `../`)

Type-only imports use `import type { ... }`.

## Components

- Function declarations: `export default function MyComponent()`. No arrow-function components.
- One primary component per file, as the default export. File-local sub-components go below it after:
  ```ts
  /* ─── 하위 컴포넌트 ─────────────────────────── */
  ```
  File-local non-component helpers (any file) go last, after `/* ─── 내부 ─────────────────────────── */`. Constants and exports stay above both markers.
- Props: `interface ComponentNameProps` above the component.
- Server Components by default. `"use client"` only for state, effects, event handlers, or browser APIs.
- Links and routers come from `@/i18n/navigation`, never `next/link`.
- No hardcoded user-facing copy in JSX — it goes in `src/messages/*.json`.
- **Exception — event pages `src/app/events/[slug]/` (`/events/{slug}`), and the code they render: `src/activities/**` and `src/events/**`.** They live outside `[locale]` on purpose (no locale prefix; one URL for QR codes and preview links). There, use `next/link` instead of `@/i18n/navigation`, and Korean copy may be inline, come from `src/events/`, or come straight from the event record (`card`, `copy`) instead of `src/messages/*.json`. Preview tokens go through `validPreviewToken()` (`src/lib/event-access.ts`) before reaching the API, the same check the middleware uses. The list `/[locale]/events` follows the normal rules, except that its event cards link with `next/link` too (event URLs have no locale prefix).

## Naming

| What               | Convention                    | Example                  |
| ------------------ | ----------------------------- | ------------------------ |
| Component files    | PascalCase `.tsx`             | `BuyBar.tsx`             |
| Other files        | camelCase `.ts`               | `format.ts`              |
| `src/lib/` files   | kebab-case `.ts`              | `event-access.ts`        |
| Directories        | lowercase                     | `home/`, `lib/`          |
| Functions          | camelCase, verb first         | `formatKRW`, `handleBuy` |
| Hooks              | `use` prefix                  | `useBodyScrollLock`      |
| Exported constants | UPPER_SNAKE_CASE + `as const` | `PRODUCT`, `HOME_MEDIA`  |
| Interfaces / types | PascalCase, no `I` prefix     | `Order`, `Locale`        |
| Booleans           | `is` / `has` / `can` prefix   | `isOpen`, `hasAddress`   |
| localStorage keys  | dot-separated, `suaci.` first | `suaci.take-four.mine`   |

Activity-owned storage keys carry the activity id after `suaci.` (`suaci.take-four.*`) so activities never collide. Keys already on users' devices in production (the take four. IndexedDB `take-four`/`strips`/`last`) are never renamed.

## Types

- `interface` for object shapes and props; `type` for unions and aliases.
- Shared domain types live in `src/types/` and are re-exported from `src/types/index.ts`.
- No `any`. Use `unknown` and narrow.

## Styling

- Tailwind utility classes. Design tokens live in `src/app/globals.css` (`@theme inline`) — use tokens, not raw hex values.
- **Exception — take four. theme.** `src/activities/take-four/theme.ts` and the `--tf-*` variables it sets are scoped to that activity's `Screen` root, not the site. Raw hex values from the design are allowed in `theme.ts`; components inside the activity use `--tf-*` for palette colors (one-off shadow `rgba()` values from the design are fine).
- Mobile first: base classes for mobile, then `sm:` / `md:` / `lg:`.
- Conditional classes with template literals.

## Errors & async

- `async`/`await` by default. Inside `useEffect`, a `.then()` chain is fine (keeps `react-hooks` lint happy).
- The API layer throws `ApiClientError`. UI code catches it and shows a state — never let it crash a page.
- Use a bare `catch {}` when the error value isn't needed.
- Invalid route params → `notFound()`.

## Comments

Code says **what**. Comments say **why**.

- Write a comment when the reason isn't obvious from the code: a business rule, a workaround, an invariant, a non-obvious trade-off.
  ```ts
  // 재시도는 정확히 1회 — refresh까지 401이면 토큰을 비우고 그대로 던진다
  ```
- Exported functions, interfaces, and constants that aren't self-explanatory get a one-line JSDoc `/** ... */`. Korean is fine.
- Group long objects with `// ---- auth ----` style separators.
- TODOs carry a scope: `// TODO(배포): Stripe 결제 키로 교체`. No bare `// TODO`.
- `eslint-disable` must say why on the same line.
- Don't write:
  - comments that restate the code (`// 카운트 증가`)
  - commented-out code — delete it, git has it
  - history (`// v4에서 바뀜`, dates, "임시로 추가") — that belongs in the commit message

## Testing

- **Vitest + jsdom.** Test files sit next to the code: `format.ts` → `format.test.ts`.
- **What to test**: logic with branches — formatting, state machines, API clients, contexts. Not markup or styling.
- **Names**: `describe("<unit>")`, `it("<조건> → <기대 결과>")`. Korean is fine.
  ```ts
  describe("format", () => {
    it("discountPercent: 할인 없으면 null", () => {
      expect(discountPercent(money(38000))).toBeNull();
    });
  });
  ```
- One behavior per `it`. Arrange → act → assert.
- Test through the public API, not internals.
- Isolation: `src/test/setup.ts` clears `localStorage` before each test. Stub globals with `vi.stubGlobal` and restore with `vi.restoreAllMocks()`.
- No snapshot tests. No real network.
- Fixing a bug → add a failing test first, then fix.

## Commits

`type(scope): 요약` — `feat` · `fix` · `refactor` · `chore` · `docs` · `test` · `ci`. One logical change per commit.

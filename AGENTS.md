# AGENTS.md — SUACI Official

## Build / Lint / Test Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start dev server (Next.js 16) |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint (eslint-config-next with core-web-vitals + typescript) |
| `npx tsc --noEmit` | TypeScript type check (strict mode) |

No test framework is configured yet (no jest/vitest). When one is added, update this section.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

Key variables: `OPENAI_API_KEY`, `OPENAI_MODEL`, `NEXT_PUBLIC_SITE_URL`.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript 5 (strict)
- **Styling**: Tailwind CSS v4 (config in `src/app/globals.css` via `@theme inline`)
- **i18n**: next-intl v4 — 5 locales: `ko` (default), `en`, `zh`, `ja`, `th`
- **Package manager**: pnpm
- **Path alias**: `@/*` → `./src/*`
- **LLM**: OpenAI SDK (`openai` package), abstracted via `src/lib/llm/`

## Project Structure

```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── [locale]/           # i18n pages (layout, page, skin-check/)
│   └── api/                # API routes (analyze/, og/)
├── components/             # React components
│   ├── layout/             # Header, Footer
│   ├── sections/           # Landing page sections
│   ├── skin-check/         # Skin analysis feature components
│   └── ui/                 # Shared UI primitives
├── constants/              # App-wide constants (UPPER_SNAKE_CASE, `as const`)
├── data/                   # Business domain data (products, slides)
├── hooks/                  # Custom React hooks
├── i18n/                   # next-intl config (routing, navigation, request)
├── lib/                    # Library abstractions (LLM providers)
├── messages/               # i18n JSON message files (ko, en, zh, ja, th)
├── types/                  # TypeScript type definitions + barrel index
├── utils/                  # Utility functions
└── middleware.ts            # next-intl middleware
```

## Code Style Guidelines

### Formatting

- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Double quotes (`"`) everywhere — imports, JSX attributes, strings
- **Semicolons**: Always
- **Trailing commas**: Yes in multi-line objects/arrays/parameters
- **Interface fields**: End with `;` (not commas)

### Imports

Order imports in these groups, separated by blank lines:

1. `"use client"` directive (if needed, always first line)
2. React built-ins (`react`, `react-dom`)
3. Framework/third-party (`next/*`, `next-intl`, `openai`)
4. Internal aliases (`@/i18n/*`, `@/constants/*`, `@/components/*`, `@/lib/*`, `@/types`, `@/utils/*`)
5. Relative imports (`./`, `../`)

Use `import type { ... } from "..."` for type-only imports (never inline `type`).

### Components

- **Always use function declarations**: `export default function MyComponent()` — never arrow function components
- **One default export per component file** for the primary component
- **Sub-components** go in the same file below the main component, separated by:
  ```ts
  /* ─── 하위 컴포넌트 ─────────────────────────── */
  ```
- **Props**: Define a named interface (`ComponentNameProps`) above the component. For file-local helpers, inline types are acceptable.
- **`"use client"`** only when needed (useState, useEffect, event handlers, browser APIs). Default to Server Components.

### Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Component files | PascalCase `.tsx` | `ProductCard.tsx` |
| Non-component files | camelCase `.ts` | `useCarousel.ts`, `format.ts` |
| Directories | lowercase, single word | `sections/`, `hooks/`, `utils/` |
| Components | PascalCase | `ResultCard`, `ScoreGauge` |
| Functions | camelCase | `handleCapture`, `formatPrice` |
| Hooks | `use` prefix | `useCarousel` |
| Constants (exported) | UPPER_SNAKE_CASE | `SITE`, `LOADING_MESSAGES` |
| Interfaces | PascalCase, no `I` prefix | `Product`, `CameraProps` |
| Props interfaces | `ComponentNameProps` | `ResultCardProps`, `ShareButtonsProps` |
| Types (aliases) | PascalCase | `Locale`, `Phase` |

### Types

- Prefer **`interface`** for object shapes and props
- Use **`type`** only for aliases (`type Locale = ...`)
- Domain types go in `src/types/` with barrel re-export in `index.ts`
- Props interfaces are co-located in the component file
- Use `as const` on constant objects and arrays
- Add JSDoc comments on interfaces (Korean is fine)

### Exports

- **Components**: `export default function` (one per file)
- **Everything else**: Named exports (`export const`, `export function`, `export interface`)
- **Types barrel**: `export type { ... } from "./..."` in `src/types/index.ts`

### Styling

- **Tailwind CSS v4 utility classes only** — no CSS modules, no styled-components
- Template literals for conditional classes: `` className={`text-sm ${isDark ? "text-foreground" : "text-white"}`} ``
- Shared padding via `SECTION_PADDING_X` constant from `@/constants/site`
- Custom theme tokens defined in `src/app/globals.css` (`--color-*`, `--font-*`)
- Responsive: use Tailwind breakpoint prefixes (`sm:`, `md:`, `lg:`, `xl:`)

### Error Handling

- `try/catch` with safe defaults (return `[]`, return error response)
- Bare `catch` blocks (no error variable) when error details aren't needed
- Guard clauses with `notFound()` for invalid routes
- Mark unimplemented logic with `// TODO:` comments
- No `throw` in application code — errors are caught and returned as responses

### Async Patterns

- **async/await only** — no `.then()` chains
- Next.js 16 `params` are `Promise` — always `await params`
- Server components can be `async`
- All async functions use function declarations (no async arrows)

### i18n

- Use `@/i18n/navigation` for `Link`, `useRouter`, `usePathname` (not `next/link`)
- Server: `const t = useTranslations("namespace")`
- Client: same `useTranslations("namespace")` hook
- Messages in `src/messages/{locale}.json`, organized by namespace
- Locale prefix strategy: `"as-needed"` (Korean has no prefix)

### LLM Integration

- LLM logic is abstracted in `src/lib/llm/` via `LLMProvider` interface
- To add a new provider: implement `LLMProvider`, add case in `createLLMProvider()`
- System prompts and analysis constants live in `src/constants/skinCheck.ts`
- API routes in `src/app/api/` handle request validation and error responses

---
name: verify
description: Run the full pre-merge gate (format, lint, types, tests, build) and report pass/fail per step. Use before committing, opening a PR, or saying work is done.
allowed-tools: Bash(pnpm format:check) Bash(pnpm lint) Bash(pnpm exec tsc --noEmit) Bash(pnpm test) Bash(pnpm build)
---

Run each step in order. Keep going after a failure so the report covers every step.

1. `pnpm format:check`
2. `pnpm lint`
3. `pnpm exec tsc --noEmit`
4. `pnpm test`
5. `pnpm build`

Report as a table: step, pass/fail, and for failures the first relevant error lines with `file:line`.

If `format:check` fails, run `pnpm format` and re-check — that one is safe to fix automatically. Don't fix other failures unless asked; report them.

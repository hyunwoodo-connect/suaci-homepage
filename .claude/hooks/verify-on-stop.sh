#!/bin/bash
# Stop: src 아래 TS 변경이 있으면 tsc + test를 돌린다. 실패하면 멈추지 못하게 하고 이유를 돌려준다.
input=$(cat)
# 이미 이 훅 때문에 이어서 작업 중이면 다시 막지 않는다 (무한 루프 방지)
[[ "$(jq -r '.stop_hook_active' <<<"$input")" == "true" ]] && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0

changed=$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } 2>/dev/null | grep -E '^src/.*\.tsx?$')
[[ -z "$changed" ]] && exit 0

fail=""
tsc_out=$(pnpm exec tsc --noEmit 2>&1) || fail+=$'\n[tsc]\n'"$(head -30 <<<"$tsc_out")"
test_out=$(pnpm test 2>&1) || fail+=$'\n[test]\n'"$(grep -E 'FAIL|×|Error' <<<"$test_out" | head -30)"

if [[ -n "$fail" ]]; then
  jq -n --arg r "Verification failed. Fix before finishing:$fail" '{decision: "block", reason: $r}'
fi
exit 0

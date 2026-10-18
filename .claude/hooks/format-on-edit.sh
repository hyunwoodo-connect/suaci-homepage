#!/bin/bash
# PostToolUse(Edit|Write): 고친 파일 하나만 Prettier로 정리하고, TS면 ESLint 결과를 Claude에게 돌려준다.
# PostToolUse의 exit 2는 막지 않고 stderr를 Claude에게 보여준다.
file=$(jq -r '.tool_input.file_path // empty')
[[ -z "$file" || ! -f "$file" ]] && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0

case "$file" in
  "$CLAUDE_PROJECT_DIR"/*) ;;
  *) exit 0 ;; # 레포 밖 파일은 건드리지 않는다
esac

case "$file" in
  *.ts | *.tsx | *.js | *.mjs | *.json | *.md | *.css | *.yml | *.yaml)
    pnpm exec prettier --write --log-level=warn "$file" >/dev/null 2>&1
    ;;
esac

case "$file" in
  *.ts | *.tsx)
    if ! out=$(pnpm exec eslint --fix "$file" 2>&1); then
      echo "ESLint errors in $file:" >&2
      echo "$out" >&2
      exit 2
    fi
    ;;
esac
exit 0

@AGENTS.md
@docs/project-context.md

# Claude Code

위 두 파일이 코드 규칙과 프로젝트 맥락이다. 여기는 Claude Code에서만 쓰는 작업 방식.

## 일하는 방식

- **에이전트**: 새 페이지·섹션·기능처럼 범위를 정해야 하는 일은 `pm` → `frontend-engineer`. 스펙이 분명한 구현은 바로 `frontend-engineer`.
- **시각 작업**에는 `frontend-design` 스킬을 쓴다.
- **모바일 우선.** 데스크탑 세부는 오너가 직접 디자인한다. Claude는 모바일 반응형을 책임지고 데스크탑은 여지를 남긴다.
- **완료 전** `/verify`를 돌린다.
- skin-check / 퍼스널 컬러 기능은 되살리지 않는다.

## 하네스 (`.claude/`)

|                           | 하는 일                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `hooks/format-on-edit.sh` | Edit·Write 직후 그 파일만 Prettier, TS면 ESLint `--fix`. 남은 에러는 바로 알려준다 |
| `hooks/verify-on-stop.sh` | 끝내기 전에 `src` TS 변경이 있으면 tsc + test. 실패하면 끝나지 않는다              |
| `skills/verify`           | `/verify` — format · lint · tsc · test · build 전체                                |
| `agents/`                 | `pm`, `frontend-engineer` (opus 고정)                                              |
| `settings.json`           | 팀 공용 권한·훅. 개인 설정은 `settings.local.json`(gitignore)                      |

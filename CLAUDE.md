@AGENTS.md
@docs/project-context.md

# Claude Code

위 두 파일이 코드 규칙과 프로젝트 맥락이다. 여기는 Claude Code에서만 쓰는 작업 방식.

## 일하는 방식

- **개발은 대화하는 메인이 직접 한다.** 구현을 서브에이전트에 맡기지 않는다. 범위를 정해야 하는 큰 일의 설계만 Fable, 머지 전 리뷰는 Sonnet 읽기 전용 리뷰어(워크스페이스 루트 `CLAUDE.md` '모델·에이전트·토큰 규칙').
- **필요한 부분만 읽는다.** 기능별 세부는 `docs/site-notes.md`(늘 싣지 않는다) — 고칠 기능 이름으로 `grep -n` 해서 그 줄만 읽는다.
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
| `settings.json`           | 팀 공용 권한·훅. 개인 설정은 `settings.local.json`(gitignore)                      |

옛 `pm`·`frontend-engineer` 에이전트(Opus에 기획·구현을 맡기던 것)는 `docs/archive/agents/`에 옮겨 두었다. 쓰지 않는다.

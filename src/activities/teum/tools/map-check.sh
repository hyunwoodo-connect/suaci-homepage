#!/usr/bin/env bash
# '틈' 지도 점검: 지도 하나를 지어 보고 — 지도 점검(겹침·물 위·범위 밖·없는 에셋) · 놓인 수 · 첫 화면 목록과 바이트 ·
# 성능 한 번(에뮬레이션: 헤드리스 크롬, CPU 4배 느리게 — 폰 실기가 아니다)을 보여 준다. 지도를 바꿀 때마다 돌린다.
# 처음 한 번: (cd src/activities/teum/tools && npm i) — 도구 전용 패키지(puppeteer-core 등)를 받는다. 앱 의존성과 따로다.
# 사용: map-check.sh [지도=isle] [씨앗=1] [개발 서버 주소=http://localhost:3210]
#   ① 값만 보는 지도 점검 시험(vitest, 등록된 지도 모두) ② 개발 서버(`next dev`)에서 ?map=·?seed= 로 지어 센다(tools/mapCheck.mjs).
#   ?map·?seed 는 개발 서버에서만 듣는다(운영 빌드는 늘 기본 지도).
#   크롬은 깔려 있는 것을 쓴다: 기본 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome, 다른 곳이면 TEUM_CHROME=<경로>.
set -euo pipefail

MAP="${1:-isle}"
SEED="${2:-1}"
ORIGIN="${3:-http://localhost:3210}"
TOOLS="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${TOOLS}/../../../.." && pwd)"
CHROME="${TEUM_CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

if [[ ! -d "${TOOLS}/node_modules/puppeteer-core" ]]; then
  echo "도구 패키지가 없다 — 한 번만: (cd ${TOOLS} && npm i)" >&2
  exit 1
fi
if [[ ! -x "${CHROME}" ]]; then
  echo "크롬이 ${CHROME} 에 없다 — TEUM_CHROME=<크롬 실행 파일 경로> 로 준다" >&2
  exit 1
fi
if ! curl -s -o /dev/null --max-time 5 "${ORIGIN}/events/teum"; then
  echo "${ORIGIN} 이 열리지 않는다 — 레포에서 ./node_modules/.bin/next dev -p 3210 을 먼저 띄운다" >&2
  exit 1
fi

echo "== ① 지도 점검 시험(값만) =="
(cd "${ROOT}" && ./node_modules/.bin/vitest run src/activities/teum/game/maps --reporter=dot)

echo
echo "== ② 지어 보기 =="
TEUM_CHROME="${CHROME}" node "${TOOLS}/mapCheck.mjs" "${ORIGIN}" "${MAP}" "${SEED}"

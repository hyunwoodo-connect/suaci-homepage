#!/usr/bin/env bash
# '틈' 지도 점검: 지도 하나를 지어 보고 — 지도 점검(겹침·물 위·범위 밖·없는 에셋) · 놓인 수 · 첫 화면 목록과 바이트 ·
# 성능 한 번(에뮬레이션: 헤드리스 크롬, CPU 4배 느리게 — 폰 실기가 아니다)을 보여 준다.
# 사용: map-check.sh [지도=v64] [씨앗=1] [개발 서버 주소=http://localhost:3210]
#   ① 값만 보는 지도 점검 시험(vitest, 등록된 지도 모두) ② 개발 서버(`next dev`)에서 ?map=·?seed= 로 지어 센다.
#   ?map·?seed 는 개발 서버에서만 듣는다(운영 빌드는 늘 기본 지도). 브라우저 쪽 도구(puppeteer)는 레포 밖
#   TEUM_WORK(기본 /tmp/teum-work)의 mapcheck.mjs 다.
set -euo pipefail

MAP="${1:-v64}"
SEED="${2:-1}"
ORIGIN="${3:-http://localhost:3210}"
WORK="${TEUM_WORK:-/tmp/teum-work}"
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"

if [[ ! -f "${WORK}/mapcheck.mjs" ]]; then
  echo "${WORK}/mapcheck.mjs 가 없다 — 브라우저 쪽 도구가 있는 폴더를 TEUM_WORK 로 준다" >&2
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
node "${WORK}/mapcheck.mjs" "${ORIGIN}" "${MAP}" "${SEED}"

#!/usr/bin/env bash
# '틈' 에셋 올리기: 배포본 한 버전을 공개 경로(events/teum/<버전>/)에, 원본을 비공개 경로(events/teum/source/)에.
# 버전 폴더는 덮어쓰지 않는다 — 바꾸려면 새 버전(v2…)으로 빌드해서 올리고 게임의 ASSET_VERSION 만 바꾼다.
# 사용: upload.sh <배포본 버전 폴더> <원본 폴더> <버전>   예: upload.sh ~/teum/dist/v1 ~/teum/raw v1
set -euo pipefail

ACCOUNT="609124256714"
PROFILE="suaci"
REGION="ap-northeast-2"
BUCKET="suaci-main-mediabucket-qtuvosjyqpbf"
PUBLIC_BASE="https://d1s7tfjxu4yefe.cloudfront.net"
IMMUTABLE="public, max-age=31536000, immutable"

if [[ $# -ne 3 ]]; then
  echo "사용: $0 <배포본 버전 폴더> <원본 폴더> <버전>" >&2
  exit 1
fi
DIST="${1%/}"
RAW="${2%/}"
VERSION="$3"
PREFIX="events/teum/${VERSION}"

# ---- 계정 확인: 개인 계정(suaci 프로필)만 ----
if [[ -n "${AWS_PROFILE:-}" && "${AWS_PROFILE}" != "${PROFILE}" ]]; then
  echo "AWS_PROFILE=${AWS_PROFILE} — ${PROFILE} 이 아니라서 멈춘다" >&2
  exit 1
fi
if [[ -n "${AWS_ACCESS_KEY_ID:-}" || -n "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
  echo "AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY 가 셸에 있다(프로필을 무시한다) — 멈춘다" >&2
  exit 1
fi
actual="$(aws sts get-caller-identity --profile "${PROFILE}" --query Account --output text)"
if [[ "${actual}" != "${ACCOUNT}" ]]; then
  echo "계정이 ${actual} — ${ACCOUNT} 이 아니라서 멈춘다" >&2
  exit 1
fi

aws_() { aws --profile "${PROFILE}" --region "${REGION}" "$@"; }

# ---- 올릴 것 확인 ----
if [[ ! -f "${DIST}/manifest.json" ]]; then
  echo "${DIST}/manifest.json 이 없다" >&2
  exit 1
fi
if ! grep -q "\"version\": \"${VERSION}\"" "${DIST}/manifest.json"; then
  echo "${DIST}/manifest.json 의 version 이 ${VERSION} 이 아니다" >&2
  exit 1
fi
if [[ ! -d "${RAW}" ]]; then
  echo "원본 폴더 ${RAW} 가 없다" >&2
  exit 1
fi
# 아래 네 가지 말고는 올리지 않는다(형식이 빠진 채 올라가지 않게)
others="$(find "${DIST}" -type f ! -name '.DS_Store' ! -name '*.glb' ! -name '*.json' ! -name '*.jpg' ! -name '*.webp')"
if [[ -n "${others}" ]]; then
  echo "형식을 정하지 않은 파일이 있다:" >&2
  echo "${others}" >&2
  exit 1
fi

# ---- 이미 있는 버전은 덮어쓰지 않는다 ----
existing="$(aws_ s3api list-objects-v2 --bucket "${BUCKET}" --prefix "${PREFIX}/manifest.json" \
  --query "length(Contents[?Key=='${PREFIX}/manifest.json'] || \`[]\`)" --output text)"
if [[ "${existing}" != "0" ]]; then
  echo "s3://${BUCKET}/${PREFIX}/manifest.json 이 이미 있다 — 새 버전 이름으로 올린다" >&2
  exit 1
fi

# ---- 배포본: 형식마다 Content-Type 을 정해 올리고, manifest.json 은 맨 마지막 ----
upload_type() {
  local pattern="$1" type="$2"
  aws_ s3 cp "${DIST}/" "s3://${BUCKET}/${PREFIX}/" --recursive --only-show-errors \
    --exclude "*" --include "${pattern}" --exclude "manifest.json" \
    --content-type "${type}" --cache-control "${IMMUTABLE}"
}
upload_type "*.glb" "model/gltf-binary"
upload_type "*.jpg" "image/jpeg"
upload_type "*.webp" "image/webp"
upload_type "*.json" "application/json"
# manifest 가 올라가야 게임이 이 버전을 쓴다 — 파일이 다 올라간 뒤에
aws_ s3 cp "${DIST}/manifest.json" "s3://${BUCKET}/${PREFIX}/manifest.json" --only-show-errors \
  --content-type "application/json" --cache-control "${IMMUTABLE}"

# ---- 원본 보관: 비공개 경로, 공개 캐시 머리말 없이 ----
aws_ s3 sync "${RAW}/" "s3://${BUCKET}/events/teum/source/" --only-show-errors --exclude ".DS_Store"

echo "올렸다. 확인할 주소: ${PUBLIC_BASE}/${PREFIX}/manifest.json"

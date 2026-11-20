#!/usr/bin/env bash
# 존별 색 바꾸기 변형 모델만 올리기: 이미 올린 배포본 버전(events/teum/<버전>/)에 variants.mjs 가 만든 새 파일(<원본>@<존>.glb)을 더한다.
# 버전 안의 원래 파일·manifest.json 은 건드리지 않는다(게임은 저장소의 manifest 사본을 읽는다). 이미 있는 파일은 덮어쓰지 않는다.
# 사용: upload-variants.sh <배포본 버전 폴더> <버전>   예: upload-variants.sh ~/teum/dist/v10 v10
set -euo pipefail

ACCOUNT="609124256714"
PROFILE="suaci"
REGION="ap-northeast-2"
BUCKET="suaci-main-mediabucket-qtuvosjyqpbf"
IMMUTABLE="public, max-age=31536000, immutable"

if [[ $# -ne 2 ]]; then
  echo "사용: $0 <배포본 버전 폴더> <버전>" >&2
  exit 1
fi
DIST="${1%/}"
VERSION="$2"
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

if [[ ! -f "${DIST}/variants.json" ]]; then
  echo "${DIST}/variants.json 이 없다 — 먼저 node variants.mjs ${DIST}" >&2
  exit 1
fi
# variants.json 의 file 들(분류/이름@존.glb)
files="$(node -e 'const v=require(process.argv[1]);for(const a of Object.values(v))console.log(a.file)' "${DIST}/variants.json")"
for file in ${files}; do
  if [[ "${file}" != *@*.glb ]]; then
    echo "변형 파일이 아니다(건너뜀): ${file}" >&2
    continue
  fi
  key="${PREFIX}/${file}"
  if aws_ s3api head-object --bucket "${BUCKET}" --key "${key}" >/dev/null 2>&1; then
    echo "이미 있다(덮어쓰지 않는다): ${key}"
    continue
  fi
  aws_ s3 cp "${DIST}/${file}" "s3://${BUCKET}/${key}" --only-show-errors \
    --content-type "model/gltf-binary" --cache-control "${IMMUTABLE}"
  echo "올림: ${key}"
done

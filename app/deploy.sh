#!/bin/bash
# 민국이의 꿈 — NAS 배포 스크립트
# 사용: ~/class_democra_dev/app/deploy.sh
#
# 흐름:
#   1) 로컬에서 Vite 빌드 (dist/ 생성)
#   2) NAS 배포 경로(/Volumes/web/class_democra/app/) 비우고 dist/ 복사
#   3) 끝나면 https://babosam.net/class_democra/app/ 에서 확인

set -e

# 1. 소스 디렉토리로 이동
cd "$(dirname "$0")"

echo "🔨 빌드 시작..."
npm run build

# 2. 빌드 성공 시 NAS로 복사
TARGET=/Volumes/web/class_democra/app

if [ ! -d "$TARGET" ]; then
  echo "📁 배포 폴더 생성: $TARGET"
  mkdir -p "$TARGET"
fi

echo "🧹 기존 배포 파일 정리: $TARGET"
rm -rf "$TARGET"/*

echo "📦 dist/ → $TARGET 복사"
cp -R dist/* "$TARGET"/

echo ""
echo "✅ 배포 완료!"
echo "👉 https://babosam.net/class_democra/app/ 에서 확인"

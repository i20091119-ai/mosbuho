#!/usr/bin/env bash
# ============================================================================
# fetch-assets.sh — 라이선스 프리 에셋 자동 다운로드 (폰트 + 아이콘)
# ----------------------------------------------------------------------------
# 인터넷이 되는 환경에서 실행하면 CHECKLIST.md 의 "확정적인" 에셋을 정확한
# 파일명으로 assets/ 아래에 받아 넣습니다.
#   - 폰트: Pretendard(OFL), IBM Plex Mono(OFL)
#   - 아이콘: Lucide(ISC) 9개 + Twemoji(CC-BY 4.0) 3개
# 자동화하지 않는 것(취향/원본 필요):
#   - unDraw 일러스트(welcome/step-*.svg) : 색·구도 선택 필요 → 수동
#   - gnmc_logo.png : 기관 공식 원본 필요 → 수동
#
# 사용:  bash booth-app/scripts/fetch-assets.sh
# (외부 접속이 허용된 에이전트 환경이면 에이전트가 이 스크립트를 그대로 실행하면 됩니다.)
# ============================================================================
set -u
cd "$(dirname "$0")/.." || exit 1   # booth-app/ 로 이동

ICONS="assets/icons"
FONTS="assets/fonts"
mkdir -p "$ICONS" "$FONTS"

ok=0; fail=0
get() { # get <url> <dest>
  if curl -fsSL "$1" -o "$2" 2>/dev/null; then
    echo "  ✓ $2"; ok=$((ok+1))
  else
    echo "  ✗ 실패: $2  ($1)"; fail=$((fail+1))
  fi
}

echo "── 1) 폰트 (assets/fonts/) ─────────────────────────────"
# Pretendard 가변폰트 (400~800 전부 커버)
get "https://raw.githubusercontent.com/orioncactus/pretendard/main/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2" \
    "$FONTS/PretendardVariable.woff2"
# IBM Plex Mono (IBM/plex repo, complete woff2) — 400/600/700
IPM="https://raw.githubusercontent.com/IBM/plex/master/packages/plex-mono/fonts/complete/woff2"
get "$IPM/IBMPlexMono-Regular.woff2"  "$FONTS/IBMPlexMono-Regular.woff2"
get "$IPM/IBMPlexMono-SemiBold.woff2" "$FONTS/IBMPlexMono-SemiBold.woff2"
get "$IPM/IBMPlexMono-Bold.woff2"     "$FONTS/IBMPlexMono-Bold.woff2"

echo "── 2) 아이콘 — Lucide (assets/icons/) ──────────────────"
LU="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons"
get "$LU/play.svg"        "$ICONS/play.svg"
get "$LU/square.svg"      "$ICONS/stop.svg"
get "$LU/volume-2.svg"    "$ICONS/sound.svg"
get "$LU/volume-x.svg"    "$ICONS/mute.svg"
get "$LU/camera.svg"      "$ICONS/camera.svg"
get "$LU/camera-off.svg"  "$ICONS/camera-off.svg"
get "$LU/rotate-ccw.svg"  "$ICONS/refresh.svg"
get "$LU/check.svg"       "$ICONS/check.svg"
get "$LU/radio-tower.svg" "$ICONS/telegraph.svg"

echo "── 3) 아이콘 — Twemoji 컬러 (assets/icons/) ────────────"
TW="https://raw.githubusercontent.com/jdecked/twemoji/master/assets/svg"
get "$TW/1f389.svg" "$ICONS/success.svg"    # 🎉
get "$TW/1f534.svg" "$ICONS/bead-red.svg"   # 🔴
get "$TW/1f535.svg" "$ICONS/bead-blue.svg"  # 🔵

echo
echo "완료: 성공 $ok / 실패 $fail"
echo
echo "다음 단계:"
echo "  1) 폰트가 받아졌으면 css/style.css 의 @font-face 주석 블록을 해제하세요."
echo "  2) 수동 필요: assets/img/{welcome,step-*}.svg (unDraw, CC0), assets/gnmc_logo.png (기관 원본)."
echo "  3) 라이선스 표기: Twemoji(CC-BY 4.0) 사용 시 안내판/README 에 1줄 표기 권장."
[ "$fail" -eq 0 ] || { echo; echo "일부 실패 시: 네트워크/프록시 또는 URL 변경 확인. 수동 다운로드는 CHECKLIST.md 참고."; }

#!/usr/bin/env bash
# ============================================================================
# register-bridge.sh — App Lab 브리지(Morse Booth Bridge) 설치 + 부팅 자동실행 지정
# ----------------------------------------------------------------------------
# 대당 1회. setup-unoq.sh 는 이 부분을 App Lab 소관이라 안 건드리므로 별도로 실행.
#   1) 앱 설치(임포트): arduino-app-cli app install <arduino 폴더>
#   2) 부팅 기본앱 지정: arduino-app-cli properties set default user:arduino
#      (폴더명이 'arduino' 라 앱 ID 는 항상 user:arduino)
# 사용:  bash ~/mosbuho/booth-app/deploy/register-bridge.sh
# 확인(재부팅 후):  curl -s http://localhost:8080/status ; echo
# ============================================================================
set -u
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../arduino" && pwd)"
CLI="arduino-app-cli"
APP_ID="user:arduino"

command -v "$CLI" >/dev/null 2>&1 || {
  echo "✗ '$CLI' 를 찾을 수 없습니다. Arduino App Lab 이 설치된 UNO Q 에서 실행하세요."; exit 1; }

echo "[1/3] 앱 설치(임포트): $SRC"
if $CLI app install "$SRC" 2>&1; then
  echo "  ✓ 설치 완료"
else
  echo "  ℹ 설치 명령이 실패했습니다(이미 설치돼 있으면 정상)."
  echo "    미설치인데 계속 실패하면 App Lab GUI 에서 '$SRC' 를 Import 하세요:"
  echo "      cd ~/mosbuho/booth-app && zip -r ~/morse-booth.zip arduino  →  App Lab > My Apps > Import"
fi

echo "[2/3] 부팅 기본앱 지정 → $APP_ID"
if $CLI properties set default "$APP_ID" 2>&1; then
  echo "  ✓ 지정 완료"
else
  echo "  ✗ 지정 실패 — 'arduino-app-cli app list' 로 실제 앱 ID 를 확인해 그 ID 로 다시 지정하세요."
  echo "     arduino-app-cli properties set default <ID>"
fi

echo "[3/3] 확인"
printf '  현재 기본앱: '; $CLI properties get default 2>/dev/null || echo '(확인 실패)'
echo "  → 재부팅 후:  curl -s http://localhost:8080/status ; echo   ({\"hw\": ...} 나오면 자동실행 성공)"

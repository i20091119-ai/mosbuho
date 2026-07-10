#!/usr/bin/env bash
# ============================================================================
# update-applab.sh — App Lab 으로 가져온 "Morse Booth Bridge" 앱(들)을
#                     git 최신 코드로 덮어쓴다. (중복 폴더 전부 갱신 + 확인 출력)
# ----------------------------------------------------------------------------
# App Lab 은 import 한 앱을 자체 폴더에 "복사"해 둔다. git pull 만으론 그 복사본이
# 안 바뀌므로, 이 스크립트가 git pull + 복사본 갱신을 한 번에 한다.
#
# 사용 (이 한 줄이면 끝):
#   bash ~/mosbuho/booth-app/deploy/update-applab.sh
#   → 끝나면 App Lab 에서 Stop → Run
# ============================================================================
set -u
SRC="$HOME/mosbuho/booth-app/arduino"

echo "[1/3] 최신 코드 받기 (git pull)"
git -C "$HOME/mosbuho" pull --quiet 2>/dev/null && echo "  OK" || echo "  (건너뜀/오프라인)"

echo "[2/3] App Lab 앱 폴더 찾아 갱신"
FOUND=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  d=$(dirname "$f")
  cp -f "$SRC/app.yaml"          "$d/app.yaml"          2>/dev/null
  cp -f "$SRC/python/main.py"    "$d/python/main.py"    2>/dev/null
  cp -f "$SRC/sketch/sketch.ino" "$d/sketch/sketch.ino" 2>/dev/null
  [ -f "$SRC/sketch/sketch.yaml" ]      && cp -f "$SRC/sketch/sketch.yaml"      "$d/sketch/sketch.yaml"      2>/dev/null
  [ -f "$SRC/python/requirements.txt" ] && cp -f "$SRC/python/requirements.txt" "$d/python/requirements.txt" 2>/dev/null
  echo "  ✓ $d"
  FOUND=$((FOUND + 1))
done < <(find "$HOME" -name app.yaml ! -path '*/mosbuho/*' -exec grep -l "Morse Booth Bridge" {} \; 2>/dev/null)

if [ "$FOUND" = 0 ]; then
  echo "  ✗ App Lab 앱 폴더를 못 찾음 — App Lab 에서 한 번 import 했는지 확인하세요."
  exit 1
fi

echo "[3/3] 적용된 ports 확인 (아래가  - 8080  이어야 정상)"
while IFS= read -r f; do
  [ -z "$f" ] && continue
  echo "  ${f%/app.yaml}:"
  grep -A1 'ports' "$f" 2>/dev/null | sed 's/^/      /'
done < <(find "$HOME" -name app.yaml ! -path '*/mosbuho/*' -exec grep -l "Morse Booth Bridge" {} \; 2>/dev/null)

echo
echo "끝! 이제 App Lab 에서  Stop → Run  하세요."

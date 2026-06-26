#!/usr/bin/env bash
# ============================================================================
# update-applab.sh — App Lab 으로 가져온 "Morse Booth Bridge" 앱 복사본을
#                     git 최신 코드(~/mosbuho)로 덮어쓴다.
# ----------------------------------------------------------------------------
# App Lab 은 가져온(import) 앱을 자체 폴더에 "복사"해 둡니다. 그래서 git pull 만으론
# 그 복사본이 안 바뀝니다. 이 스크립트가 그 복사본을 찾아 최신 파일로 갱신합니다.
#
# 사용:
#   cd ~/mosbuho && git pull
#   bash booth-app/deploy/update-applab.sh
#   → 끝나면 App Lab 에서 Stop → Run
# ============================================================================
set -u
SRC="$HOME/mosbuho/booth-app/arduino"

echo "[1/2] App Lab 앱 폴더 찾는 중..."
CANDS=$(find "$HOME" -name app.yaml 2>/dev/null | grep -v "/mosbuho/")
TARGET=$(echo "$CANDS" | xargs -r grep -ls "Morse Booth Bridge" 2>/dev/null | head -1)

if [ -z "$TARGET" ]; then
  echo "  ✗ App Lab 앱 폴더를 못 찾았습니다. 아래 후보를 그대로 알려주세요:"
  echo "$CANDS"
  exit 1
fi
D=$(dirname "$TARGET")
echo "  찾음: $D"

echo "[2/2] 최신 코드 복사 중..."
cp -f "$SRC/app.yaml"                 "$D/app.yaml"
cp -f "$SRC/python/main.py"           "$D/python/main.py"
cp -f "$SRC/sketch/sketch.ino"        "$D/sketch/sketch.ino"
[ -f "$SRC/sketch/sketch.yaml" ]      && cp -f "$SRC/sketch/sketch.yaml" "$D/sketch/sketch.yaml"
[ -f "$SRC/python/requirements.txt" ] && cp -f "$SRC/python/requirements.txt" "$D/python/requirements.txt"

echo "✓ 완료: $D"
echo "  이제 App Lab 에서 Stop → Run 하세요."
echo "  (Python 로그가 '부스 브리지 HTTP 시작' 으로 바뀌면 새 코드 적용된 것)"

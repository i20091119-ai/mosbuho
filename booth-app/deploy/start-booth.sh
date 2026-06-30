#!/usr/bin/env bash
# ============================================================================
# start-booth.sh — 정적 서버 + 크롬 키오스크로 부스앱 띄우기
# ----------------------------------------------------------------------------
#  - http://localhost:8000 로 booth-app 을 서빙 (이미 떠 있으면 재사용)
#  - 크롬을 전체화면 키오스크로 실행 (URL바·탭 없음)
#  - 카메라(getUserMedia)는 localhost 라 보안컨텍스트 OK
#
# 종료(부스 운영 중 빠져나오기): 키보드 연결 후 Alt+F4,
#   또는 Ctrl+Alt+F2 로 콘솔 전환 → `pkill chromium`
# ============================================================================
set -u

# booth-app 디렉터리 = 이 스크립트(.../deploy)의 부모
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8000}"
URL="http://localhost:${PORT}/index.html"

# 0) 디스플레이 깨우기 — 부팅 시 USB-C→HDMI 영상 인식 타이밍 문제 보정
#    (모니터가 늦게 준비돼 "신호 없음"으로 남는 경우, HDMI 재꽂기 대신 자동 재인식)
kick_display() {
  command -v xrandr >/dev/null 2>&1 || { echo "ℹ xrandr 없음 — 디스플레이 자동깨우기 건너뜀"; return 0; }
  echo "디스플레이 인식 시도..."
  local i outs o
  for i in $(seq 1 15); do
    outs="$(xrandr --query 2>/dev/null | awk '/ connected/{print $1}')"
    if [ -n "$outs" ]; then
      for o in $outs; do xrandr --output "$o" --auto 2>/dev/null || true; done
      # 활성 모드(*)가 잡혔으면 성공
      if xrandr --query 2>/dev/null | grep -q '\*'; then
        echo "  ✓ 디스플레이 활성: $outs"; return 0
      fi
    fi
    sleep 1   # 모니터가 늦게 준비될 수 있어 재질의(=커넥터 재탐지)하며 대기
  done
  echo "  ⚠ 자동 인식 실패 — 모니터 입력(mini-HDMI)·케이블 확인 필요"
}
kick_display

# 0.5) 화면 절전·블랭크 끄기 — 부스는 종일 켜둠(가만 둬도 화면이 안 꺼지게).
#   리눅스 기본값이 ~10분 무입력이면 화면을 끄는데(DPMS/스크린세이버), 터치/마우스
#   입력이 없으면 발동하므로 X11 에서 명시적으로 해제한다.
disable_blanking() {
  export DISPLAY="${DISPLAY:-:0}"
  if command -v xset >/dev/null 2>&1; then
    xset s off 2>/dev/null || true        # 스크린세이버 끄기
    xset s noblank 2>/dev/null || true    # 화면 블랭크 끄기
    xset -dpms 2>/dev/null || true        # 모니터 절전(DPMS) 끄기
    echo "  ✓ 화면 절전(DPMS/blank/스크린세이버) 해제 (DISPLAY=$DISPLAY)"
  else
    echo "  ℹ xset 없음 — 화면 절전 해제 건너뜀(설치: sudo apt install x11-xserver-utils)"
  fi
}
disable_blanking

# 1) 한글 폰트 점검 (없으면 경고만)
if command -v fc-list >/dev/null && ! fc-list | grep -qiE "noto.*cjk|nanum|noto sans kr"; then
  echo "⚠ 한글 시스템 폰트가 없어 보입니다. 먼저 setup-unoq.sh 실행을 권장합니다."
fi

# 1.5) 브리지(부저·버튼)는 App Lab 의 "Run as startup"(기본 앱) 설정으로 부팅 시 자동 실행됨.
#   여기서 중복으로 띄우면 8080 포트 충돌(Failed)이 나므로 일부러 시작하지 않는다.

# 2) 정적 서버 (이미 응답하면 그대로 사용)
if ! curl -s "http://localhost:${PORT}" >/dev/null 2>&1; then
  echo "정적 서버 시작: $APP_DIR (포트 $PORT)"
  ( cd "$APP_DIR" && exec python3 -m http.server "$PORT" ) >/tmp/booth-http.log 2>&1 &
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -s "http://localhost:${PORT}" >/dev/null 2>&1 && break
    sleep 0.5
  done
else
  echo "이미 떠 있는 서버(포트 $PORT) 재사용"
fi

# 3) 크롬 찾기
CHROME="$(command -v chromium || command -v chromium-browser || command -v google-chrome || true)"
if [ -z "$CHROME" ]; then
  echo "✗ 크롬(chromium)을 찾을 수 없습니다. setup-unoq.sh 로 설치하세요." >&2
  exit 1
fi

# 4) 키오스크 실행
#   - 전용 프로필: 카메라 권한 등 설정 유지
#   - use-fake-ui-for-media-stream: 카메라 권한 팝업 없이 자동 허용
#   - autoplay-policy: 부저 소리(WebAudio) 제스처 없이 재생 허용
exec "$CHROME" \
  --user-data-dir="$HOME/.config/booth-chromium" \
  --kiosk "$URL" \
  --start-fullscreen \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  --overscroll-history-navigation=0 \
  --disable-pinch \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --no-first-run \
  --noerrdialogs

#!/usr/bin/env bash
# ============================================================================
# install-autostart.sh — 로그인(부팅) 시 부스앱 키오스크 자동실행 등록 (XFCE/표준 XDG)
# ----------------------------------------------------------------------------
# 등록 후 다음 로그인부터 start-booth.sh 가 자동 실행됩니다.
# 해제:  rm ~/.config/autostart/booth-kiosk.desktop
# ============================================================================
set -e

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOSTART_DIR="$HOME/.config/autostart"
DESKTOP="$AUTOSTART_DIR/booth-kiosk.desktop"

mkdir -p "$AUTOSTART_DIR"
cat > "$DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=GNMC Booth Kiosk
Comment=경남수학문화관 우주통신사 부스앱 키오스크
Exec=bash "$DEPLOY_DIR/start-booth.sh"
Terminal=false
X-GNOME-Autostart-enabled=true
EOF

echo "✓ 자동시작 등록 완료: $DESKTOP"
echo "  다음 로그인부터 키오스크가 자동 실행됩니다."
echo "  해제하려면:  rm $DESKTOP"

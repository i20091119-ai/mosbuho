#!/usr/bin/env bash
# ============================================================================
# install-display-service.sh — 부팅 시 화면 강제 재인식 systemd 서비스 설치
# ----------------------------------------------------------------------------
# display-detect.sh 를 root 로 부팅 때 돌려서 HDMI 재꽂기를 자동 대체.
# sudo 권한 필요(서비스 설치). 한 번만 실행하면 됨.
#
# 사용:  bash booth-app/deploy/install-display-service.sh
# 해제:  sudo systemctl disable --now booth-display-detect.service
# ============================================================================
set -e
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "→ display-detect.sh 설치 (/usr/local/bin)"
sudo install -m 0755 "$SRC/display-detect.sh" /usr/local/bin/booth-display-detect.sh

echo "→ systemd 서비스 등록"
sudo tee /etc/systemd/system/booth-display-detect.service >/dev/null <<'EOF'
[Unit]
Description=Booth display connector re-detect (HDMI hotplug fix)
After=graphical.target
Wants=graphical.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/booth-display-detect.sh 60

[Install]
WantedBy=graphical.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable booth-display-detect.service >/dev/null 2>&1 || true

echo "✓ 설치 완료. 다음 부팅부터 화면을 자동으로 다시 인식합니다."
echo "  지금 바로 한 번 시험:  sudo systemctl start booth-display-detect.service"

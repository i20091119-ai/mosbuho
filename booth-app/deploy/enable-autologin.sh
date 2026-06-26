#!/usr/bin/env bash
# ============================================================================
# enable-autologin.sh — 부팅 시 로그인 화면 없이 바로 데스크톱 진입(자동 로그인)
# ----------------------------------------------------------------------------
# 부스 무인 운영용. 디스플레이 매니저(LightDM/GDM3)를 감지해 현재 사용자로
# 자동 로그인되게 설정합니다. sudo 권한이 필요해 비밀번호를 한 번 물어봅니다.
# (비밀번호는 어디에도 저장하지 않습니다 — 로그인 화면만 건너뜁니다.)
#
# 사용:  bash booth-app/deploy/enable-autologin.sh
# 해제:  LightDM → sudo rm /etc/lightdm/lightdm.conf.d/50-booth-autologin.conf
# ============================================================================
set -u
U="$(whoami)"
echo "자동 로그인 대상 사용자: $U"
DONE=0

# ── LightDM (Debian XFCE 기본) ──────────────────────────────────────────────
if [ -d /etc/lightdm ] || command -v lightdm >/dev/null 2>&1; then
  echo "→ LightDM 감지, 설정 중..."
  sudo mkdir -p /etc/lightdm/lightdm.conf.d
  sudo tee /etc/lightdm/lightdm.conf.d/50-booth-autologin.conf >/dev/null <<EOF
[Seat:*]
autologin-user=$U
autologin-user-timeout=0
EOF
  sudo groupadd -f autologin 2>/dev/null || true
  sudo gpasswd -a "$U" autologin >/dev/null 2>&1 || true
  DONE=1
fi

# ── GDM3 ────────────────────────────────────────────────────────────────────
if [ -f /etc/gdm3/custom.conf ]; then
  echo "→ GDM3 감지, 설정 중..."
  sudo sed -i \
    -e 's/^#*[[:space:]]*AutomaticLoginEnable[[:space:]]*=.*/AutomaticLoginEnable=true/' \
    -e "s/^#*[[:space:]]*AutomaticLogin[[:space:]]*=.*/AutomaticLogin=$U/" \
    /etc/gdm3/custom.conf
  grep -q '^AutomaticLoginEnable' /etc/gdm3/custom.conf \
    || sudo sed -i "/^\[daemon\]/a AutomaticLoginEnable=true\nAutomaticLogin=$U" /etc/gdm3/custom.conf
  DONE=1
fi

if [ "$DONE" = 1 ]; then
  echo "✓ 자동 로그인 설정 완료. 재부팅하면 로그인 화면 없이 바로 들어갑니다."
else
  echo "✗ 디스플레이 매니저를 못 찾았습니다. 아래 결과를 알려주세요:"
  cat /etc/X11/default-display-manager 2>/dev/null || echo "(default-display-manager 파일 없음)"
fi

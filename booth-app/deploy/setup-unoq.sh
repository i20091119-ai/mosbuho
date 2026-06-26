#!/usr/bin/env bash
# ============================================================================
# setup-unoq.sh — 새 Arduino UNO Q 1대 한 번만 실행하는 셋업 스크립트
# ----------------------------------------------------------------------------
# 하는 일 (새 우노 1대 완전 자동 셋업)
#   1) 한글/이모지 시스템 폰트 설치 (네이버 등 모든 한글 표시 + 부스앱 폴백 보강)
#   2) 부스앱 저장소 내려받기/갱신
#   3) 자동 로그인 설정 (부팅 시 로그인 화면 건너뜀)
#   4) 부팅 자동시작 등록 (부스앱 키오스크 + 브리지)
#   5) 완료 — 재부팅하면 전원만 켜도 부스앱이 풀스크린으로 뜸
#
# 사용법 (새 우노에서, 이 두 줄이면 끝):
#   git clone -b claude/focused-tesla-cpbbqo https://github.com/i20091119-ai/mosbuho.git ~/mosbuho
#   bash ~/mosbuho/booth-app/deploy/setup-unoq.sh
#
# 환경변수로 덮어쓰기 가능: REPO_URL / BRANCH / APP_ROOT
# 부분만 끄고 싶으면:  NO_AUTOLOGIN=1 / NO_AUTOSTART=1
# ============================================================================
set -uo pipefail

REPO_URL="${REPO_URL:-https://github.com/i20091119-ai/mosbuho.git}"
BRANCH="${BRANCH:-claude/focused-tesla-cpbbqo}"   # ← main 으로 병합되면 main 으로 변경
APP_ROOT="${APP_ROOT:-$HOME/mosbuho}"

say() { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }

say "[1/5] 한글·이모지 시스템 폰트 설치"
if sudo apt-get update; then
  sudo apt-get install -y fonts-noto-cjk fonts-noto-color-emoji \
    || warn "폰트 설치 실패 — 네트워크/권한 확인. (앱은 자체 번들 폰트로 동작)"
else
  warn "apt-get update 실패 — 네트워크 확인. 폰트 설치를 건너뜀."
fi
# 크롬이 없으면 설치 시도 (대개 이미 있음)
if ! command -v chromium >/dev/null && ! command -v chromium-browser >/dev/null; then
  warn "chromium 미발견 — 설치 시도"
  sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser || warn "chromium 자동설치 실패 — 수동 설치 필요"
fi

say "[2/5] 부스앱 내려받기/갱신 ($BRANCH)"
if [ -d "$APP_ROOT/.git" ]; then
  git -C "$APP_ROOT" fetch origin "$BRANCH" \
    && git -C "$APP_ROOT" checkout "$BRANCH" \
    && git -C "$APP_ROOT" pull origin "$BRANCH" \
    || warn "git 갱신 실패 — 수동 확인 필요"
else
  git clone -b "$BRANCH" "$REPO_URL" "$APP_ROOT" || warn "git clone 실패"
fi

DEPLOY="$APP_ROOT/booth-app/deploy"

say "[3/5] 자동 로그인 설정"
if [ "${NO_AUTOLOGIN:-0}" = "1" ]; then
  echo "건너뜀 (NO_AUTOLOGIN=1)"
elif [ -f "$DEPLOY/enable-autologin.sh" ]; then
  bash "$DEPLOY/enable-autologin.sh" || warn "자동 로그인 설정 실패 — 수동 확인"
else
  warn "enable-autologin.sh 없음 — git 갱신 확인"
fi

say "[4/5] 부팅 자동시작 등록 (부스앱 키오스크)"
if [ "${NO_AUTOSTART:-0}" = "1" ]; then
  echo "건너뜀 (NO_AUTOSTART=1)"
elif [ -f "$DEPLOY/install-autostart.sh" ]; then
  bash "$DEPLOY/install-autostart.sh" || warn "자동시작 등록 실패 — 수동 확인"
else
  warn "install-autostart.sh 없음 — git 갱신 확인"
fi

say "[5/5] 완료 — 재부팅하면 전원만 켜도 부스앱이 뜹니다"
echo "지금 바로 보려면 :  bash $DEPLOY/start-booth.sh"
echo "또는 재부팅      :  전원으로 콜드 부팅(모니터 먼저 켠 뒤). sudo reboot 는 화면 깜빡 이슈 있음."
echo
echo "※ 폰트는 크롬을 껐다 켜야(또는 재부팅) 반영됩니다."

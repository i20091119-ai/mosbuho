#!/usr/bin/env bash
# ============================================================================
# setup-unoq.sh — 새 Arduino UNO Q 1대 한 번만 실행하는 셋업 스크립트
# ----------------------------------------------------------------------------
# 하는 일
#   1) 한글/이모지 시스템 폰트 설치 (네이버 등 모든 한글 표시 + 부스앱 폴백 보강)
#   2) 부스앱 저장소 내려받기/갱신
#   3) (안내) 실행·자동시작 방법 출력
#
# 사용법 (새 우노에서):
#   git clone -b claude/focused-tesla-cpbbqo https://github.com/i20091119-ai/mosbuho.git ~/mosbuho
#   bash ~/mosbuho/booth-app/deploy/setup-unoq.sh
#
# 환경변수로 덮어쓰기 가능: REPO_URL / BRANCH / APP_ROOT
# ============================================================================
set -uo pipefail

REPO_URL="${REPO_URL:-https://github.com/i20091119-ai/mosbuho.git}"
BRANCH="${BRANCH:-claude/focused-tesla-cpbbqo}"   # ← main 으로 병합되면 main 으로 변경
APP_ROOT="${APP_ROOT:-$HOME/mosbuho}"

say() { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }

say "[1/3] 한글·이모지 시스템 폰트 설치"
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

say "[2/3] 부스앱 내려받기/갱신 ($BRANCH)"
if [ -d "$APP_ROOT/.git" ]; then
  git -C "$APP_ROOT" fetch origin "$BRANCH" \
    && git -C "$APP_ROOT" checkout "$BRANCH" \
    && git -C "$APP_ROOT" pull origin "$BRANCH" \
    || warn "git 갱신 실패 — 수동 확인 필요"
else
  git clone -b "$BRANCH" "$REPO_URL" "$APP_ROOT" || warn "git clone 실패"
fi

say "[3/3] 완료"
DEPLOY="$APP_ROOT/booth-app/deploy"
echo "지금 바로 실행      :  bash $DEPLOY/start-booth.sh"
echo "부팅 시 자동실행 등록 :  bash $DEPLOY/install-autostart.sh"
echo
echo "폰트 적용은 크롬을 완전히 껐다 다시 켜야 반영됩니다."

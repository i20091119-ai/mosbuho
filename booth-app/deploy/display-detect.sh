#!/usr/bin/env bash
# ============================================================================
# display-detect.sh — DRM 커넥터 강제 재인식(HDMI 재꽂기 효과). root 로 실행.
# ----------------------------------------------------------------------------
# 부팅 시 USB-C→HDMI 영상 인식 타이밍 문제로 "신호 없음"이 남는 경우,
# /sys/class/drm/*/status 에 "detect" 를 써서 커넥터를 강제로 다시 탐지한다.
# 모니터가 늦게 준비될 수 있어 일정 시간(기본 60초) 반복한다.
#
# 사용(보통 systemd 서비스가 호출):  sudo display-detect.sh [지속초]
# ============================================================================
set -u
DUR="${1:-60}"
deadline=$((SECONDS + DUR))
ok=0

while [ "$SECONDS" -lt "$deadline" ]; do
  for s in /sys/class/drm/*/status; do
    [ -e "$s" ] || continue
    echo detect > "$s" 2>/dev/null || true     # 커넥터 강제 재탐지(HPD/EDID 재읽기)
  done
  # 연결된 커넥터가 잡히면 몇 번 더 하고 종료
  if grep -qxs connected /sys/class/drm/*/status 2>/dev/null; then
    ok=$((ok + 1))
    [ "$ok" -ge 3 ] && break
  fi
  sleep 2
done
exit 0

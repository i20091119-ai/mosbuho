# 부스앱 배포 가이드 (Arduino UNO Q 새 장비 셋업)

우노 4대(+예비)에 **동일하게 적용**하기 위한 자동화 스크립트입니다.
새 우노 1대당 아래 3줄이면 끝납니다.

## 새 우노에 처음 올리기

리눅스 데스크톱이 뜬 상태에서 **터미널**을 열고:

```bash
# 1) 앱 내려받기
git clone -b claude/focused-tesla-cpbbqo https://github.com/i20091119-ai/mosbuho.git ~/mosbuho

# 2) 셋업(한글폰트 설치 + 앱 갱신) — 비밀번호 물으면 우노 로그인 비번
bash ~/mosbuho/booth-app/deploy/setup-unoq.sh

# 3) 실행
bash ~/mosbuho/booth-app/deploy/start-booth.sh
```

- `setup-unoq.sh` = **한 번만**. 한글·이모지 폰트(`fonts-noto-cjk`) 설치 + 저장소 받기.
  - 폰트가 깔리면 **네이버 등 모든 한글**이 제대로 나오고, 부스앱 폴백도 든든해집니다.
  - 폰트 적용은 **크롬을 껐다 켜야** 반영됩니다.
- `start-booth.sh` = 정적 서버(`localhost:8000`) + **크롬 전체화면 키오스크** 실행.

## 부팅하면 자동으로 뜨게 (부스 운영용)

```bash
bash ~/mosbuho/booth-app/deploy/install-autostart.sh
```

다음 로그인부터 키오스크가 자동 실행됩니다.
해제: `rm ~/.config/autostart/booth-kiosk.desktop`

## 앱만 최신으로 갱신할 때

```bash
cd ~/mosbuho && git pull
# 크롬에서 Ctrl+Shift+R (강력 새로고침)  또는 키오스크 재시작
```

## 키오스크 빠져나오기 / 끄기
- 키보드 연결 후 **Alt+F4**
- 또는 **Ctrl+Alt+F2** 로 콘솔 전환 → `pkill chromium`

## 자주 막히는 곳
- **한글이 네모(□)** → `setup-unoq.sh` 안 돌렸거나 크롬 재시작 안 함. 폰트 설치 후 크롬 완전 종료 후 재실행.
- **`Permission denied`(apt)** → `sudo` 빠짐. 스크립트는 내부에서 `sudo`를 씁니다(비번 입력).
- **카메라 안 켜짐** → `start-booth.sh`가 권한 팝업을 자동 허용하지만, 안 되면 주소창 없는 키오스크라 한 번은 일반 크롬에서 `localhost:8000` 열어 "허용"을 눌러두면 프로필에 저장됩니다.
- **소리가 HDMI로** → `pactl list short sinks` 로 허브 오디오 확인 후 `pactl set-default-sink <허브-sink>`.
- **chromium 명령 없음** → `sudo apt install -y chromium` (또는 `chromium-browser`).

> 하드웨어(부저·아케이드 버튼·LED) 결선은 `../arduino/HARDWARE_SETUP.md` 참고.

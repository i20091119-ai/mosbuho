# 부스앱 배포 가이드 (Arduino UNO Q 새 장비 셋업)

우노 4대(+예비)에 **동일하게 적용**하기 위한 자동화 스크립트입니다.
새 우노 1대당 아래 3줄이면 끝납니다.

## 새 우노에 처음 올리기 — **두 줄이면 끝**

리눅스 데스크톱이 뜬 상태에서 **터미널**을 열고:

```bash
git clone -b claude/focused-tesla-cpbbqo https://github.com/i20091119-ai/mosbuho.git ~/mosbuho
bash ~/mosbuho/booth-app/deploy/setup-unoq.sh
```

`setup-unoq.sh` 하나가 **전부 자동**으로 합니다 (sudo 비번 1회 물음 = 우노 로그인 비번):
1. 한글·이모지 폰트(`fonts-noto-cjk`) 설치 → 네이버 등 모든 한글 정상 + 부스앱 폴백
2. 앱 저장소 받기/갱신
3. **자동 로그인** 설정 (부팅 시 로그인 화면 건너뜀)
4. **부팅 자동시작** 등록 (부스앱 키오스크 + 브리지)

끝나면 **재부팅 → 전원만 켜도 부스앱이 풀스크린**으로 뜹니다. 터미널 만질 일 없음.

> 일부만 빼고 싶을 때: `NO_AUTOLOGIN=1` / `NO_AUTOSTART=1` 환경변수로 끌 수 있음.
> 예) `NO_AUTOLOGIN=1 bash ~/mosbuho/booth-app/deploy/setup-unoq.sh`

### 개별 스크립트 (필요할 때만)
- `start-booth.sh` — 지금 바로 띄우기(정적서버 + 크롬 키오스크 + 브리지 시도)
- `enable-autologin.sh` — 자동 로그인만 (해제: `sudo rm /etc/lightdm/lightdm.conf.d/50-booth-autologin.conf`)
- `install-autostart.sh` — 부팅 자동시작만 (해제: `rm ~/.config/autostart/booth-kiosk.desktop`)
- `update-applab.sh` — App Lab 브리지 앱을 git 최신코드로 갱신

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

# 부스 4대 제작 체크리스트 (UNO Q)

한 대당 **① 소프트웨어 셋업(명령 1줄) → ② App Lab 브리지 등록(부저·버튼) → ③ 결선 → ④ 점검**.
4대 모두 **똑같이** 반복하면 됩니다. 상세 배선은 `arduino/HARDWARE_SETUP.md` 참고.

> 준비: 셋업 동안만 **인터넷(Wi-Fi)** 필요(코드 내려받기·폰트 설치). 완성 후엔 **오프라인** 운영.

---

## 한 대 셋업 (①~④ 순서대로, 4대 반복)

### ① 소프트웨어 — 명령 2줄
UNO Q를 모니터·전원에 연결해 리눅스 데스크탑이 뜨면, 터미널에서:
```bash
git clone -b claude/focused-tesla-cpbbqo https://github.com/i20091119-ai/mosbuho.git ~/mosbuho
bash ~/mosbuho/booth-app/deploy/setup-unoq.sh
```
이 한 번으로 **자동** 처리: 한글·이모지 폰트 · 자동 로그인 · 부팅 시 **키오스크 자동실행** · 화면 재인식 · **절전/화면꺼짐 차단**.
(부분만 끄려면 `NO_AUTOLOGIN=1` `NO_AUTOSTART=1` `NO_POWERFIX=1` 등 앞에 붙임)

### ② App Lab 브리지 등록 — 부저·버튼 (한 대당 1회, 필수)
`arduino/` 앱이 **부저 재생 + 아케이드 버튼 입력**을 담당. `setup-unoq.sh`는 이걸 **안** 건드리므로(App Lab 소관) **대당 1회 꼭** 등록. 폴더명이 `arduino`라 앱 ID는 항상 **`user:arduino`**.

**CLI (권장) — 스크립트 1줄:**
```bash
bash ~/mosbuho/booth-app/deploy/register-bridge.sh
```
(내부적으로 `arduino-app-cli app install ~/mosbuho/booth-app/arduino` + `properties set default user:arduino` 실행)

수동으로 하려면:
```bash
arduino-app-cli app install ~/mosbuho/booth-app/arduino   # 설치(임포트)
arduino-app-cli properties set default user:arduino        # 부팅 자동실행 지정
arduino-app-cli properties get default                     # user:arduino 나오면 OK
```

**GUI 대안** (CLI `app install` 이 안 될 때만):
1. `cd ~/mosbuho/booth-app && zip -r ~/morse-booth.zip arduino`
2. App Lab → **My Apps** → **Import** → `~/morse-booth.zip`
3. **Run** 으로 확인 → 그 뒤 `arduino-app-cli properties set default user:arduino` 로 자동실행 지정.

확인(재부팅 후): `curl -s http://localhost:8080/status ; echo` → `{"hw": true/false}` 나오면 브리지 살아있음.

> ⚠️ **핵심**: 앱을 Run 만 하면 재부팅 시 안 뜸 → **`properties set default user:arduino`(기본앱 지정)** 을 반드시 해야 부팅 자동실행.
> 코드가 바뀌면: `bash ~/mosbuho/booth-app/deploy/update-applab.sh` 후 App Lab Stop→Run(또는 재부팅).

### ③ 결선 (UNO Q Arduino 헤더) — 상세는 HARDWARE_SETUP.md
**이 부스 구성은 선 2가닥이면 끝** (버튼 LED 미사용 → ULN2003·12V 어댑터 불필요):

| 핀 | 연결 |
|---|---|
| **D2** | 수동(passive) 부저 (+) / GND(−)  ← 직결(드라이버 불필요) |
| **D3** | 전신기(또는 아케이드 버튼) 스위치 NO / COM→GND (INPUT_PULLUP) |
| **GND** | 부저(−) + 버튼 COM 을 GND 한 점에 **공통** |

> (선택) 버튼 불빛을 쓰려면 **D4 → ULN2003 IN1 →(OUT1)→ LED(−), LED(+)→+5V**. 안 쓰면 D4·ULN2003·12V 전부 생략(코드 수정 불필요, 보드 내장 LED 로 누름 표시).

주변장치: **웹캠 → 허브 USB-A**, **모니터 HDMI**, **스피커 3.5mm**, 입력장치(트랙볼 — 아래 터치 참고).

### ④ 점검
- [ ] 전원만 켜면 **키오스크(전체화면)** 로 자동 실행 (가만 둬도 화면 안 꺼짐)
- [ ] **③미션** → "신호 다시 보기" 누르면 **부저로 신호 재생**(App Lab 브리지 실행 중일 때)
- [ ] **전신기/버튼** 누르면 미션 **답신 입력**됨(+ 누를 때 부저·LED 사운더)
- [ ] **④카메라** → 갈색 모직판에 비즈 한 글자 놓으면 인식(둥근=점, 긴 원통=대시)
- [ ] 소리: 답신 전신키 삑소리가 **스피커**로 남 (필요시 아래 오디오 지정)

---

## 자주 걸리는 것 (요약)
- **부팅 후 모니터 "No Signal"** → 포터블 모니터는 **모니터 USB-C → 허브 USB-A** 케이블이 빠지면 화면 안 뜸(가장 흔한 함정). 정전식 HID 터치모니터면 해당 없음.
- **터치** → 포터블 1530it은 터치가 USB-C 영상과 한 몸이라 **미지원 → USB 트랙볼/마우스**. **정전식 HID(드라이버 불필요) 터치모니터**면 터치 USB를 허브 USB-A에 꽂으면 됨.
- **부저 무음** → App Lab 앱이 실행 중인지(Run as startup) + **수동(passive) 부저**인지 확인.
- **소리가 HDMI(모니터)로 감** → 허브 스피커로 지정:
  ```bash
  pactl list short sinks
  pactl set-default-sink <허브/USB 오디오 sink>
  ```
- **가만 두면 꺼짐** → `setup-unoq.sh` 가 절전·화면꺼짐을 끔. 이미 켜둔 기기엔 즉시:
  ```bash
  sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
  export DISPLAY=:0; xset s off; xset s noblank; xset -dpms
  ```

## 현재 체험 흐름 (6단계)
①학년 → ②이야기 → ③미션(해독+답신) → ④카메라(비즈 한 글자씩·이니셜3/날짜4) → ⑤팔찌 → ⑥마무리
(전신키 자유연습·신호확인·통계 화면은 현장 의견으로 제거. 물리 버튼은 미션 답신 입력에만 사용)

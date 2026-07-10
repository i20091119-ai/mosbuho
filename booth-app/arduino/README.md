# UNO Q 하드웨어 연동 (Arduino App Lab 앱)

⑤단계의 **실물 LED·부저** 출력을 담당합니다. Arduino UNO Q는 듀얼 프로세서입니다.

- **MPU (Qualcomm Dragonwing, Debian Linux)** → `python/main.py` 실행 (브리지 HTTP 서버)
- **MCU (STM32U585)** → `sketch/sketch.ino` 실행 (LED·부저 출력)
- 둘은 **`Arduino_RouterBridge`(RPC, MessagePack)** 로 통신합니다. raw 시리얼이 아닙니다.

```
브라우저(부스 웹앱)  --HTTP-->  python/main.py (MPU)  --Bridge RPC-->  sketch.ino (MCU)
   fetch /play                    Bridge.call("play_morse")            LED + 부저 출력
```

## 통신 규약

- `GET  http://localhost:8080/status` → `{"hw": true|false}` (MCU 연결 여부)
- `POST http://localhost:8080/play`   본문 `{"morse": "... --- ...", "unit": 120}`
  - `morse`: 요소 `.`/`-`, 글자 구분 공백, 단어 구분 `/`
  - `unit`: 1 dit 길이(ms). 표준 타이밍 점=1·대시=3·요소간격=1·글자간격=3·단어간격=7

웹앱(`js/arduino.js`)은 `/status`로 연결을 감지해 **연결되면 실물**, **아니면 시뮬레이션**으로 동작합니다.

## 실행

1. **Arduino App Lab**에서 이 `arduino/` 폴더를 앱으로 엽니다.
   App Lab은 `python/`을 MPU에, `sketch/`를 MCU에 자동 배포·실행합니다.
2. 앱을 실행하면 STM32가 `Bridge.provide("play_morse", ...)`로 함수를 등록하고,
   Python 서버가 `localhost:8080`에서 대기합니다.
3. 부스 웹앱을 같은 보드의 브라우저에서 열면 ⑤단계가 자동으로 **"UNO Q 연결됨"**으로 바뀝니다.

## 배선

| 신호 | 핀 | 비고 |
|---|---|---|
| 상태 LED | `LED_BUILTIN` | 외부 LED 사용 시 `sketch.ino`의 `LED_PIN` 변경(+저항) |
| 부저 | `D2` | 수동(passive) 부저 권장. `BUZZER_PIN` |
| 아케이드 버튼 스위치 | `D3` ↔ NO, `GND` ↔ COM | `INPUT_PULLUP`(누르면 LOW). `BUTTON_PIN` |
| 아케이드 버튼 LED | `D4`(저항/트랜지스터 경유) → LED → `GND` | 누름 시 점등 + 신호재생 때 메시지 점멸. `BTN_LED_PIN` |

> **본 부스: 12V 아케이드 버튼 LED → ULN2003 드라이버로 스위칭.**
> 배선: `D4→ULN2003 IN1`, `LED(+)→12V`, `LED(−)→ULN2003 OUT1`, `12V(+)→ULN2003 COM`,
> `UNO Q GND·ULN2003 GND·12V GND 공통`. **12V DC 어댑터 별도 필요**(UNO Q/허브는 12V 미제공).
> (단일 트랜지스터 2N2222 / MOSFET 2N7000 로도 대체 가능 — 구조·코드 동일.)

## 전신키(아케이드 버튼) 입력 경로

```
버튼 누름/뗌 → STM32(D3) → Bridge.notify("key",1|0) → Python(main.py)
   → GET /keys (SSE) → 브라우저 arduino.js → 'mk-down'/'mk-up' 이벤트
   → 현재 활성 전신키 위젯(morse-key.js)이 점/대시 판정
```
- 누름 **지속시간으로 점/대시 판정**은 브라우저(morse-key)에서 하므로 타이밍 바·소리 피드백이 그대로 동작.
- **폴백**: 브리지가 없거나 SSE 연결 전이면, 화면 전신키(터치/클릭)와 **스페이스바**로도 입력 가능.
  즉 하드웨어 버튼은 "추가 입력원"이라, 브리지가 죽어도 체험은 멈추지 않음.

## 버전 호환 메모

App Lab 버전에 따라 **Python 측 Bridge import 경로/호출 방식**이 다를 수 있습니다.
`python/main.py`는 방어적으로 여러 경로를 시도하며, 실패 시 웹앱이 시뮬레이션으로 폴백하므로
부스 운영은 중단되지 않습니다. 실제 보드에서 한 번 `/status`가 `true`로 뜨는지,
`▶ 신호 재생`이 LED·부저를 구동하는지 확인한 뒤 현장 배치하세요.
(스케치의 `Bridge.provide`/`Bridge.update`, Python의 `bridge.call("play_morse", morse, unit)` 규약 기준.)

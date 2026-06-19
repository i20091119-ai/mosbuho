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
| LED | `LED_BUILTIN` | 외부 LED 사용 시 `sketch.ino`의 `LED_PIN` 변경(+저항) |
| 부저 | `D2` | 수동(passive) 부저 권장. `BUZZER_PIN`에서 변경 가능 |

## 버전 호환 메모

App Lab 버전에 따라 **Python 측 Bridge import 경로/호출 방식**이 다를 수 있습니다.
`python/main.py`는 방어적으로 여러 경로를 시도하며, 실패 시 웹앱이 시뮬레이션으로 폴백하므로
부스 운영은 중단되지 않습니다. 실제 보드에서 한 번 `/status`가 `true`로 뜨는지,
`▶ 신호 재생`이 LED·부저를 구동하는지 확인한 뒤 현장 배치하세요.
(스케치의 `Bridge.provide`/`Bridge.update`, Python의 `bridge.call("play_morse", morse, unit)` 규약 기준.)

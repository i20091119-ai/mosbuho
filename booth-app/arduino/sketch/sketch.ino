/* ============================================================================
 * sketch.ino — Arduino UNO Q (STM32U585 / MCU 측) 모스 신호 출력
 * ----------------------------------------------------------------------------
 * Arduino_RouterBridge 로 Linux(MPU)의 Python 앱과 통신.
 * Python 이 Bridge.call("play_morse", morse, unit) 로 호출하면
 * LED(점=짧게/대시=길게) + 부저를 표준 모스 타이밍(1:3:1, 글자3, 단어7)으로 출력.
 *
 * 빌드/업로드: Arduino App Lab 에서 이 앱을 실행하면 sketch 가 MCU 에,
 *             python 이 MPU 에 함께 배포된다. (booth-app/arduino/README.md 참고)
 * ==========================================================================*/
#include <Arduino_RouterBridge.h>

const int LED_PIN    = LED_BUILTIN; // 내장 LED (필요 시 외부 LED 핀으로 변경)
const int BUZZER_PIN = 2;           // 부저 핀 (수동부저 권장)
const int TONE_HZ    = 680;         // 웹앱 전신음과 동일한 음높이

volatile bool busy = false;         // 재생 중 재진입 방지

// 한 요소(점/대시) 출력: LED ON + 부저 ON, 지정 시간 유지 후 OFF
void emit(unsigned long onMs) {
  digitalWrite(LED_PIN, HIGH);
  tone(BUZZER_PIN, TONE_HZ);
  delay(onMs);
  digitalWrite(LED_PIN, LOW);
  noTone(BUZZER_PIN);
}

/*
 * play_morse: 정규화 모스 문자열을 받아 출력.
 *   morse 형식 — 요소 '.'/'-', 글자 구분 ' '(공백), 단어 구분 '/'
 *   unit      — 1 dit 길이(ms). 점=1, 대시=3, 요소간격=1, 글자간격=3, 단어간격=7
 * RPC 콜백은 별도 스레드에서 실행되므로 delay() 사용이 허용된다.
 */
void play_morse(String morse, int unit) {
  if (busy) return;
  busy = true;
  const unsigned long u = unit > 0 ? (unsigned long)unit : 120;

  for (unsigned int i = 0; i < morse.length(); i++) {
    char c = morse.charAt(i);
    if (c == '.') {            // 점: 1 unit
      emit(u);
      delay(u);                // 요소 간격 1
    } else if (c == '-') {     // 대시: 3 unit
      emit(u * 3);
      delay(u);                // 요소 간격 1
    } else if (c == ' ') {     // 글자 간격: 총 3 (이미 1 지났으므로 +2)
      delay(u * 2);
    } else if (c == '/') {     // 단어 간격: 총 7 (이미 1 지났으므로 +6)
      delay(u * 6);
    }
  }
  busy = false;
}

// 연결 확인용 (Python 이 상태 점검에 사용 가능)
int ping() { return 1; }

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Bridge.begin();
  // Linux(Python) 측에서 호출 가능한 함수 등록
  Bridge.provide("play_morse", play_morse);
  Bridge.provide("ping", ping);
}

void loop() {
  Bridge.update();      // 들어온 RPC 요청 처리 (thread-unsafe 콜백 디스패치)
}

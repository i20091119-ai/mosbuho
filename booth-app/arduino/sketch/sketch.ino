/* ============================================================================
 * sketch.ino — Arduino UNO Q (STM32U585 / MCU 측)
 * ----------------------------------------------------------------------------
 * 기능
 *   (출력) play_morse(): 확정 메시지를 LED·부저로 표준 모스 타이밍 출력
 *   (입력) 아케이드 버튼(전신키): 누름/뗌을 Python 으로 전송 → 브라우저 전신키 구동
 *   (연출) 아케이드 버튼 LED: 누르는 동안 점등 + 신호 재생 때 메시지대로 점멸
 *
 * 통신: Arduino_RouterBridge (RPC). Linux(Python) ↔ MCU.
 *   - Python → MCU : Bridge.provide("play_morse"/"ping")
 *   - MCU → Python : Bridge.notify("key", 1|0)  (버튼 상태 변화 시)
 *
 * 배선 (UNO 헤더)
 *   D2  부저(+), GND(-)
 *   D3  버튼 마이크로스위치 NO,  COM→GND      (INPUT_PULLUP: 누르면 LOW)
 *   D4  버튼 LED (저항/트랜지스터 경유), GND
 * ==========================================================================*/
#include <Arduino_RouterBridge.h>

const int LED_PIN    = LED_BUILTIN; // 내장 상태 LED
const int BUZZER_PIN = 2;           // 부저
const int BUTTON_PIN = 3;           // 아케이드 버튼 스위치 (INPUT_PULLUP)
const int BTN_LED_PIN = 4;          // 아케이드 버튼 LED
const int TONE_HZ    = 680;         // 웹앱 전신음과 동일 음높이

volatile bool busy = false;         // 재생 중 재진입 방지

// 버튼 디바운스 상태
bool btnStable = false;             // true = 눌림
bool btnLastRaw = false;
unsigned long btnLastChange = 0;
const unsigned long DEBOUNCE_MS = 15;

// 한 요소(점/대시) 출력: 상태LED + 버튼LED + 부저 ON, 유지 후 OFF
void emit(unsigned long onMs) {
  digitalWrite(LED_PIN, HIGH);
  digitalWrite(BTN_LED_PIN, HIGH);
  tone(BUZZER_PIN, TONE_HZ);
  delay(onMs);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BTN_LED_PIN, LOW);
  noTone(BUZZER_PIN);
}

/* play_morse: 정규화 모스 문자열 출력.
 *   morse — 요소 '.'/'-', 글자 구분 ' ', 단어 구분 '/'
 *   unit  — 1 dit(ms). 점1·대시3·요소간1·글자간3·단어간7 */
void play_morse(String morse, int unit) {
  if (busy) return;
  busy = true;
  const unsigned long u = unit > 0 ? (unsigned long)unit : 120;
  for (unsigned int i = 0; i < morse.length(); i++) {
    char c = morse.charAt(i);
    if (c == '.')      { emit(u);      delay(u); }
    else if (c == '-') { emit(u * 3);  delay(u); }
    else if (c == ' ') { delay(u * 2); }   // 글자 간격(총 3)
    else if (c == '/') { delay(u * 6); }   // 단어 간격(총 7)
  }
  busy = false;
}

int ping() { return 1; }

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BTN_LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BTN_LED_PIN, LOW);

  Bridge.begin();
  Bridge.provide("play_morse", play_morse);
  Bridge.provide("ping", ping);
}

void loop() {
  Bridge.update();                 // 들어온 RPC 처리(play_morse 등)

  // 버튼 디바운스 + 상태변화 전송 (재생 중이 아닐 때만 입력 처리)
  if (!busy) {
    bool raw = (digitalRead(BUTTON_PIN) == LOW);  // 눌림 = LOW
    if (raw != btnLastRaw) { btnLastRaw = raw; btnLastChange = millis(); }
    if (millis() - btnLastChange > DEBOUNCE_MS && raw != btnStable) {
      btnStable = raw;
      digitalWrite(BTN_LED_PIN, btnStable ? HIGH : LOW);  // 누르는 동안 점등
      Bridge.notify("key", btnStable ? 1 : 0);            // Linux(Python)로 통지
    }
  }
}

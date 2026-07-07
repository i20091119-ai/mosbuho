/* ============================================================================
 * arduino.js — UNO Q Python 브리지 연동 (⑥신호확인 화면은 제거됨)
 * ----------------------------------------------------------------------------
 * 남은 두 가지 역할:
 *   1) 입력: /keys SSE 구독 → 아케이드 버튼 누름/뗌을 'mk-down'/'mk-up' 문서
 *      이벤트로 흘려보냄 → ③미션 답신 전신키(morse-key.js)가 키보드처럼 받음.
 *   2) 출력: playOnBuzzer(morse, unit) → POST /play → MCU play_morse 로 부저·LED
 *      재생. ③미션 '신호 다시 보기'가 이걸 호출해 해독 신호를 부저로 들려준다.
 *
 * 브리지에 못 닿으면 조용히 무시(hwOk=false) — 화면 키/스페이스바·WebAudio 로 폴백.
 * ==========================================================================*/
(function (global) {
  'use strict';
  const BRIDGE = 'http://localhost:8080';
  let keyES = null;
  let hwOk = false;   // 브리지(하드웨어) 연결 여부

  function connectKeyStream() {
    if (keyES || typeof EventSource === 'undefined') return;
    try {
      keyES = new EventSource(BRIDGE + '/keys');
      keyES.onmessage = e => {
        if (e.data === 'down') document.dispatchEvent(new Event('mk-down'));
        else if (e.data === 'up') document.dispatchEvent(new Event('mk-up'));
      };
      keyES.onerror = () => {};   // EventSource 가 자동 재연결
    } catch (e) { keyES = null; }
  }

  async function detect() {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 1200);
      const r = await fetch(BRIDGE + '/status', { signal: ctrl.signal });
      clearTimeout(to);
      hwOk = r.ok;
      if (hwOk) connectKeyStream();
    } catch (e) { hwOk = false; /* 브리지 없음 → 폴백 */ }
  }

  // 모스 문자열을 부저(+MCU LED)로 재생. 브리지 있을 때만 전송.
  // 반환값: 부저로 보냈으면 true → 호출부(신호 재생)가 스피커 중복음을 끌 수 있음.
  function playOnBuzzer(morse, unit) {
    if (!hwOk || !morse) return false;
    try {
      fetch(BRIDGE + '/play', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ morse: String(morse), unit: Math.round(unit || 150) })
      }).catch(() => {});
      return true;
    } catch (e) { return false; }
  }

  function init() { detect(); }

  global.Arduino = { init, playOnBuzzer };
})(window);

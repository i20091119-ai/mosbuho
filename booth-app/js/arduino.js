/* ============================================================================
 * arduino.js — 물리 전신키(아케이드 버튼) 입력 브리지  (⑥신호확인 화면은 제거됨)
 * ----------------------------------------------------------------------------
 * 역할이 하나로 축소됨: UNO Q Python 브리지(localhost:8080)의 /keys SSE 를 구독해
 * 아케이드 버튼 누름/뗌을 문서 이벤트 'mk-down'/'mk-up' 으로 흘려보낸다.
 * → ③미션 답신의 전신키 위젯(morse-key.js)이 키보드 스페이스바와 동일하게 받는다.
 *
 * (LED·부저 재생, 연결 표시 등 ⑥ 화면 기능은 신호확인 단계 삭제로 함께 제거)
 * 브리지에 못 닿아도 조용히 무시 — 화면 키/스페이스바로 폴백되어 체험은 안 멈춤.
 * ==========================================================================*/
(function (global) {
  'use strict';
  const BRIDGE = 'http://localhost:8080';
  let keyES = null;

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
      if (r.ok) connectKeyStream();   // 브리지 있으면 버튼 이벤트 구독
    } catch (e) { /* 브리지 없음 → 화면 키/스페이스바 폴백 */ }
  }

  function init() { detect(); }

  global.Arduino = { init };
})(window);

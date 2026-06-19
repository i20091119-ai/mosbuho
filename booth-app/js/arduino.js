/* ============================================================================
 * arduino.js — ⑤ 아두이노 UNO Q 신호 확인 (실물 단계) + 시뮬레이션 폴백
 * ----------------------------------------------------------------------------
 * 확정된 모스 메시지를 LED 점멸 + 부저로 출력. 표준 모스 타이밍(1:3:1, 글자3, 단어7).
 *
 * 연동 구조 (UNO Q):
 *   브라우저(이 앱) → fetch http://localhost:8080  → Python(App Lab python/)
 *     → Arduino_RouterBridge: Bridge.call("play_morse", morse, unit)
 *     → STM32 스케치(sketch/): LED + 부저 실제 출력
 * 폴백:
 *   localhost 브리지에 닿지 못하면 화면 LED + AudioContext 부저로 시뮬레이션.
 *   하드웨어 연동은 이 모듈 안에 격리돼 있어 단계적으로 붙일 수 있다.
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.Morse;

  const BRIDGE = 'http://localhost:8080'; // App Lab Python 로컬 서버 (README 참고)
  let hw = false;                 // 하드웨어(브리지) 연결 여부
  let unit = 120;                 // 1 dit 길이(ms)
  let curMorse = '', curText = '', curMode = 'en';
  let playing = false, timers = [];

  function $(id) { return document.getElementById(id); }

  // ── 브리지 연결 감지 ──────────────────────────────────────────────────────
  async function detect() {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 1200);
      const r = await fetch(BRIDGE + '/status', { signal: ctrl.signal });
      clearTimeout(to);
      hw = r.ok;
    } catch (e) { hw = false; }
    renderConn();
    if (hw) connectKeyStream();   // 아케이드 버튼 이벤트(SSE) 구독
  }

  // 물리 전신키(아케이드 버튼) 이벤트 수신 → 활성 전신키 위젯으로 전달
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
  function renderConn() {
    const pill = $('ardConn');
    if (hw) { pill.className = 'conn-pill hw'; pill.innerHTML = '<span class="dot-ind"></span>UNO Q 연결됨'; }
    else { pill.className = 'conn-pill sim'; pill.innerHTML = '<span class="dot-ind"></span>시뮬레이션'; }
  }

  // ── 메시지 설정 ────────────────────────────────────────────────────────
  function setMessage(text, mode) {
    curText = (text || '').trim();
    curMode = mode || 'en';
    curMorse = M.textToMorse(curText, curMode);
    renderMessage();
  }
  function renderMessage() {
    $('ardMorse').textContent = M.morseToGlyphs(curMorse.replace(/\//g, ' / ').replace(/ /g, '  '));
    // 패턴 스트립: on/off 길이를 막대로 시각화
    const seq = M.buildPlaybackSequence(curMorse, unit);
    const strip = $('ardPattern');
    if (!seq.length) { strip.innerHTML = '<span style="color:var(--muted);font-size:13px">확정한 메시지가 여기에 표시됩니다</span>'; return; }
    strip.innerHTML = seq.map((e, i) => e.on
      ? `<span class="pon" data-i="${i}" style="width:${Math.max(8, e.ms / unit * 14)}px"></span>`
      : `<span style="display:inline-block;width:${Math.max(4, e.ms / unit * 7)}px"></span>`).join('');
  }

  // ── 재생 ───────────────────────────────────────────────────────────────
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function stop() {
    playing = false; clearTimers();
    global.CWAudio.off();
    $('ardLed').classList.remove('on');
    $('ardPattern').querySelectorAll('.pon').forEach(p => p.classList.remove('active'));
    $('ardPlay').disabled = false; $('ardStop').disabled = true;
  }
  async function play() {
    if (playing || !curMorse) return;
    playing = true;
    $('ardPlay').disabled = true; $('ardStop').disabled = false;
    // 개발 로그(dev 모드): 보드로 나갈 명령 가시화
    document.dispatchEvent(new CustomEvent('hw-cmd', { detail: { cmd: 'play_morse', args: { morse: curMorse, unit }, mode: hw ? 'HW' : 'SIM' } }));

    // 하드웨어가 있으면 보드에 한 번 전송 (보드가 자체 타이밍으로 출력)
    if (hw) {
      try { fetch(BRIDGE + '/play', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ morse: curMorse, unit }) }); } catch (e) {}
    }

    // 화면 LED(+시뮬레이션 부저) 동기 재생
    const seq = M.buildPlaybackSequence(curMorse, unit);
    const led = $('ardLed');
    const pons = Array.from($('ardPattern').querySelectorAll('.pon'));
    let t = 0, onIdx = 0;
    seq.forEach((e) => {
      if (e.on) {
        const idx = onIdx++;
        timers.push(setTimeout(() => {
          if (!playing) return;
          led.classList.add('on');
          if (pons[idx]) pons[idx].classList.add('active');
          if (!hw) global.CWAudio.on(); // 하드웨어 있으면 실제 부저가 울리므로 중복 방지
        }, t));
        timers.push(setTimeout(() => {
          if (!playing) return;
          led.classList.remove('on');
          if (!hw) global.CWAudio.off();
        }, t + e.ms));
      }
      t += e.ms;
    });
    timers.push(setTimeout(stop, t + 60));
  }

  // ── 초기화 ─────────────────────────────────────────────────────────────
  function init() {
    $('ardPlay').onclick = play;
    $('ardStop').onclick = stop;
    $('ardReconnect').onclick = detect;
    $('ardSet').onclick = () => setMessage($('ardInput').value, curMode);
    $('ardInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('ardSet').click(); });
    document.querySelectorAll('#screen-arduino [data-amode]').forEach(t => {
      t.onclick = () => {
        curMode = t.dataset.amode;
        document.querySelectorAll('#screen-arduino [data-amode]').forEach(x => x.classList.toggle('active', x === t));
      };
    });
    $('ardSpeed').oninput = function () {
      unit = +this.value; $('ardSpeedV').textContent = unit + 'ms'; renderMessage();
    };

    // ②③에서 확정한 메시지 수신
    global.Booth.onMessage((text, mode) => setMessage(text, mode));

    global.registerScreen && global.registerScreen('arduino', { onShow: detect });
    detect();
  }

  global.Arduino = { init, setMessage };
})(window);

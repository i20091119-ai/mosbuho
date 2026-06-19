/* ============================================================================
 * morse-key.js — 재사용 가능한 전신키 입력 위젯 (factory)
 * ----------------------------------------------------------------------------
 * 길게/짧게 눌러 점(·)·대시(—)를 만들고, 누름시간 타이밍 바를 보여주며,
 * 글자 단위로 해독해 콜백한다. ⑤전신키 화면(telegraph.js)과 ④미션 응답(story.js)이
 * 공용으로 사용 → 중복 구현 방지. 타이밍/판정은 morse-engine(window.Morse) 사용.
 *
 * 사용:
 *   const key = createMorseKey(containerEl, {
 *     mode:'en', unit:200, sound:true,
 *     onChar:(ch, morse)=>{...},   // 한 글자 해독될 때
 *     onWord:()=>{...},            // 단어 간격(공백)일 때 (선택)
 *     onElement:(sym)=>{...}       // 점/대시 하나 입력될 때 (선택)
 *   });
 *   key.setMode('ko'); key.setUnit(160); key.setSound(false); key.reset(); key.destroy();
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.Morse;

  global.createMorseKey = function (container, opts) {
    opts = opts || {};
    let mode = opts.mode || 'en';
    let tm = M.timingModel(opts.unit || 200);
    let sound = opts.sound !== false;

    let pressed = false, pressStart = 0, durInt = null;
    let curMorse = '', curElems = [];
    let charTmr = null, wordTmr = null;

    // ── DOM 생성 ──
    container.innerHTML = `
      <div class="elem-disp mk-elems"><span class="placeholder">아래 키를 눌러 보세요!</span></div>
      <div class="timing-wrap">
        <div class="timing-track">
          <div class="timing-mark mk-mark"></div>
          <div class="timing-mark-lbl">점 | 대시</div>
          <div class="timing-fill dot mk-fill"></div>
        </div>
        <div class="timing-labels">
          <span>짧게 = <span style="color:var(--dot)">●점</span></span>
          <span class="mono mk-cur"></span>
          <span>길게 = <span style="color:var(--dash)">▬대시</span></span>
        </div>
      </div>
      <div class="key-btn off mk-key">● 길게 누르면 대시, 짧게 누르면 점 ●</div>
      <div class="cur-morse mono mk-morse"></div>`;

    const elElems = container.querySelector('.mk-elems');
    const elFill = container.querySelector('.mk-fill');
    const elMark = container.querySelector('.mk-mark');
    const elCur = container.querySelector('.mk-cur');
    const elKey = container.querySelector('.mk-key');
    const elMorse = container.querySelector('.mk-morse');

    function updMark() {
      const pct = tm.dd / (tm.dd * 2.5) * 100;
      elMark.style.left = pct + '%';
    }
    function updBar(ms) {
      const pct = Math.min(ms / (tm.dd * 2.5) * 100, 100);
      elFill.style.width = pct + '%';
      elFill.className = 'timing-fill mk-fill ' + (ms > tm.dd ? 'dash' : 'dot');
      elCur.textContent = ms + 'ms';
    }
    function renderElems() {
      if (!curElems.length) { elElems.innerHTML = '<span class="placeholder">아래 키를 눌러 보세요!</span>'; return; }
      elElems.innerHTML = curElems.map(e => e === 'dot' ? '<span class="m-dot"></span>' : '<span class="m-dash"></span>').join('') + '<span class="caret"></span>';
    }
    function renderMorse() { elMorse.textContent = M.morseToGlyphs(curMorse); }

    function decodeCur() {
      if (!curMorse) return;
      const ch = M.decode(curMorse, mode);
      const m = curMorse;
      curMorse = ''; curElems = [];
      renderElems(); renderMorse();
      if (opts.onChar) opts.onChar(ch, m);
    }

    function sigOn() {
      if (pressed) return; pressed = true; pressStart = Date.now();
      clearTimeout(charTmr); clearTimeout(wordTmr); charTmr = wordTmr = null;
      if (sound && global.CWAudio) global.CWAudio.on();
      elKey.className = 'key-btn on mk-key'; elKey.textContent = '● ● ● 신호 전송 중 ● ● ●';
      elFill.style.width = '0';
      durInt = setInterval(() => { if (pressStart) updBar(Date.now() - pressStart); }, 25);
    }
    function sigOff() {
      if (!pressed) return; pressed = false;
      const dur = Date.now() - pressStart;
      if (global.CWAudio) global.CWAudio.off();
      elKey.className = 'key-btn off mk-key'; elKey.textContent = '● 길게 누르면 대시, 짧게 누르면 점 ●';
      clearInterval(durInt); durInt = null;
      elFill.style.width = '0'; elCur.textContent = '';
      const sym = M.durationToSymbol(dur, tm.dd);
      curMorse += sym; curElems.push(sym === '.' ? 'dot' : 'dash');
      renderElems(); renderMorse();
      if (opts.onElement) opts.onElement(sym);
      charTmr = setTimeout(() => {
        decodeCur();
        wordTmr = setTimeout(() => { if (opts.onWord) opts.onWord(); }, tm.wg - tm.cg);
      }, tm.cg);
    }

    // 이벤트
    const onDown = () => sigOn();
    const onUp = () => sigOff();
    const onLeave = () => { if (pressed) sigOff(); };
    const onTouchStart = e => { e.preventDefault(); sigOn(); };
    const onTouchEnd = e => { e.preventDefault(); sigOff(); };
    elKey.addEventListener('mousedown', onDown);
    elKey.addEventListener('mouseup', onUp);
    elKey.addEventListener('mouseleave', onLeave);
    elKey.addEventListener('touchstart', onTouchStart, { passive: false });
    elKey.addEventListener('touchend', onTouchEnd, { passive: false });

    // 키보드(스페이스) — 이 위젯이 화면에 보일 때만
    const visible = () => elKey.offsetParent !== null;
    const onKeyDown = e => { if (e.code === 'Space' && !e.repeat && visible()) { e.preventDefault(); sigOn(); } };
    const onKeyUp = e => { if (e.code === 'Space' && visible()) { e.preventDefault(); sigOff(); } };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    updMark(); renderElems();

    return {
      el: container,
      setMode(m) { mode = m; },
      setUnit(u) { tm = M.timingModel(u); updMark(); },
      setSound(s) { sound = s; },
      reset() {
        curMorse = ''; curElems = [];
        clearTimeout(charTmr); clearTimeout(wordTmr);
        renderElems(); renderMorse(); elCur.textContent = ''; elFill.style.width = '0';
      },
      destroy() {
        clearTimeout(charTmr); clearTimeout(wordTmr); clearInterval(durInt);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        container.innerHTML = '';
      }
    };
  };
})(window);

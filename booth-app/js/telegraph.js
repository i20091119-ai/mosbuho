/* ============================================================================
 * telegraph.js — ② 전신키 입력 화면 (추상 단계)
 * ----------------------------------------------------------------------------
 * 화면의 전신키를 길게/짧게 눌러 점(·)·대시(—)를 만들고 실시간 해독.
 * 모스 변환·한글 조합·타이밍은 전부 morse-engine.js(window.Morse) 사용.
 * 전신 원리를 손으로 체득하는 단계. 누름시간 판정 임계값 로직 보존.
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.Morse;

  // 상태
  let mode = 'en';
  let pressed = false, pressStart = 0, durInt = null;
  let curMorse = '', curElems = [], decoded = '';
  let composer = new M.HangulComposer();
  let charTmr = null, wordTmr = null;
  let tm = M.timingModel(200);
  let soundOn = true;
  let chOn = false, chWord = '', chIdx = 0;

  // 챌린지 단어 풀
  const CH_EN = ['SOS', 'HI', 'OK', 'HELLO', 'MORSE', 'CODE'];
  const CH_KO = ['ㅅㅏㄹㅏㅇ', 'ㅎㅏㄴㄱㅡㄹ', 'ㅁㅗㅅㅡ', 'ㅅㅜㅎㅏㄱ', 'ㅎㅣㅁ'];

  // DOM
  let elElems, elFill, elMark, elMarkLbl, elCur, elCurMorse, elDecoded, elRef, elRefTitle, elKey;

  function $(id) { return document.getElementById(id); }

  // ── 참조표 ──────────────────────────────────────────────────────────────
  const REF_CHARS = {
    en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    ko: ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ','ㅏ','ㅑ','ㅓ','ㅕ','ㅗ','ㅛ','ㅜ','ㅠ','ㅡ','ㅢ','ㅣ'],
    num: '1234567890'.split('')
  };
  function buildRef() {
    elRef.className = 'ref-grid ' + mode;
    const rev = M.getRev(mode);
    const chars = mode === 'sym' ? Object.values(M.SYM) : REF_CHARS[mode];
    elRef.innerHTML = chars.map(ch => {
      const morse = rev[ch] || '';
      return `<div class="ref-cell" data-ch="${ch}"><div class="rl">${ch}</div>
        <div class="shapes sm">${M.morseToShapesHTML(morse)}</div></div>`;
    }).join('');
    const titles = { en: '모스부호 표 (영어)', ko: '모스부호 표 (한글)', num: '모스부호 표 (숫자)', sym: '모스부호 표 (기호)' };
    elRefTitle.textContent = titles[mode];
  }
  function highlightRef(ch) {
    elRef.querySelectorAll('.ref-cell').forEach(c => c.classList.toggle('hl', c.dataset.ch === ch));
  }

  // ── 렌더 ────────────────────────────────────────────────────────────────
  function renderElems() {
    if (!curElems.length) {
      elElems.innerHTML = '<span class="placeholder">' +
        (decoded ? '다음 글자를 입력하세요' : '아래 키를 눌러 시작하세요!') + '</span>';
      return;
    }
    elElems.innerHTML = curElems.map(e =>
      e === 'dot' ? '<span class="m-dot"></span>' : '<span class="m-dash"></span>').join('') +
      '<span class="caret"></span>';
  }
  function renderMorse() { elCurMorse.textContent = M.morseToGlyphs(curMorse); }
  function renderDecoded() {
    elDecoded.innerHTML = decoded || '<span class="ph">여기에 해독 결과가 나타나요</span>';
  }

  // ── 타이밍 바 ──────────────────────────────────────────────────────────
  function updMark() {
    const pct = tm.dd / (tm.dd * 2.5) * 100;
    elMark.style.left = pct + '%';
    elMarkLbl.style.left = pct + '%';
  }
  function updBar(ms) {
    const pct = Math.min(ms / (tm.dd * 2.5) * 100, 100);
    elFill.style.width = pct + '%';
    elFill.className = 'timing-fill ' + (ms > tm.dd ? 'dash' : 'dot');
    elCur.textContent = ms + 'ms';
  }

  // ── 디코딩 ──────────────────────────────────────────────────────────────
  function decodeCur() {
    if (!curMorse) return;
    const ch = M.decode(curMorse, mode);
    if (mode === 'ko') { composer.feed(ch); decoded = composer.getFullText(); }
    else decoded += ch;
    highlightRef(ch);
    curMorse = ''; curElems = [];
    renderElems(); renderMorse(); renderDecoded();
    if (chOn && chWord && chWord[chIdx] === ch) { chIdx++; renderCh(); }
  }
  function addGap() {
    if (mode === 'ko') { composer.flush(); composer.committed += ' '; decoded = composer.getFullText(); }
    else decoded += ' ';
    renderDecoded();
  }

  // ── 신호 입력 ──────────────────────────────────────────────────────────
  function sigOn() {
    if (pressed) return; pressed = true; pressStart = Date.now();
    clearTimeout(charTmr); clearTimeout(wordTmr); charTmr = wordTmr = null;
    if (soundOn) global.CWAudio.on();
    elKey.className = 'key-btn on'; elKey.textContent = '● ● ● 신호 전송 중 ● ● ●';
    elFill.style.width = '0';
    durInt = setInterval(() => { if (pressStart) updBar(Date.now() - pressStart); }, 25);
  }
  function sigOff() {
    if (!pressed) return; pressed = false;
    const dur = Date.now() - pressStart;
    global.CWAudio.off();
    elKey.className = 'key-btn off'; elKey.textContent = '● 길게 누르면 대시, 짧게 누르면 점 ●';
    clearInterval(durInt); durInt = null;
    elFill.style.width = '0'; elCur.textContent = '';
    const sym = M.durationToSymbol(dur, tm.dd);
    curMorse += sym; curElems.push(sym === '.' ? 'dot' : 'dash');
    renderElems(); renderMorse();
    charTmr = setTimeout(() => {
      decodeCur();
      wordTmr = setTimeout(addGap, tm.wg - tm.cg);
    }, tm.cg);
  }

  // ── 리셋 ───────────────────────────────────────────────────────────────
  function reset() {
    curMorse = ''; curElems = []; decoded = ''; chIdx = 0;
    composer = new M.HangulComposer();
    clearTimeout(charTmr); clearTimeout(wordTmr);
    renderElems(); renderMorse(); renderDecoded(); highlightRef('');
    if (chOn) renderCh();
  }

  // ── 챌린지 ─────────────────────────────────────────────────────────────
  function toggleCh() {
    chOn = !chOn;
    const btn = $('tgChBtn');
    btn.textContent = chOn ? '그만하기' : '시작';
    btn.classList.toggle('primary', chOn);
    if (chOn) nextCh();
    else { chWord = ''; chIdx = 0; $('tgChArea').innerHTML = '시작을 누르면 목표 단어가 나와요'; reset(); }
  }
  function nextCh() {
    const pool = mode === 'ko' ? CH_KO : CH_EN;
    chWord = pool[Math.floor(Math.random() * pool.length)]; chIdx = 0;
    reset(); renderCh();
  }
  function renderCh() {
    if (!chOn || !chWord) return;
    const rev = M.getRev(mode);
    let h = '<div class="ch-cards">';
    for (let i = 0; i < chWord.length; i++) {
      const c = chWord[i], morse = rev[c] || '';
      const cls = i < chIdx ? 'done' : i === chIdx ? 'cur' : '';
      const col = i < chIdx ? 'var(--ok)' : i === chIdx ? 'var(--brand)' : 'var(--muted)';
      h += `<div class="ch-card ${cls}"><div class="cl" style="color:${col}">${c}</div>
        <div class="shapes sm">${M.morseToShapesHTML(morse)}</div>${i < chIdx ? '<img class="ic" src="assets/icons/check.svg" alt="완료" onerror="this.style.display=\'none\'">' : ''}</div>`;
    }
    h += '</div>';
    if (chIdx >= chWord.length) {
      h += `<div style="text-align:center;margin-top:12px;color:var(--ok);font-weight:800;font-size:18px">
        <img class="ic" src="assets/icons/success.svg" alt="" onerror="this.style.display='none'">"${chWord}" 전송 성공!
        <button class="btn sm ok" id="tgChNext" style="margin-left:8px">다음 →</button></div>`;
    }
    $('tgChArea').innerHTML = h;
    const nx = $('tgChNext'); if (nx) nx.onclick = nextCh;
  }

  // ── 모드 ───────────────────────────────────────────────────────────────
  function setMode(m) {
    mode = m;
    $('tgModeTabs').querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === m));
    buildRef(); reset(); composer = new M.HangulComposer();
  }

  // ── 초기화 ─────────────────────────────────────────────────────────────
  function init() {
    elElems = $('tgElems'); elFill = $('tgFill'); elMark = $('tgMark'); elMarkLbl = $('tgMarkLbl');
    elCur = $('tgCur'); elCurMorse = $('tgCurMorse'); elDecoded = $('tgDecoded');
    elRef = $('tgRef'); elRefTitle = $('tgRefTitle'); elKey = $('tgKey');

    buildRef(); updMark(); renderElems();

    // 키 입력 (마우스/터치)
    elKey.addEventListener('mousedown', sigOn);
    elKey.addEventListener('mouseup', sigOff);
    elKey.addEventListener('mouseleave', () => { if (pressed) sigOff(); });
    elKey.addEventListener('touchstart', e => { e.preventDefault(); sigOn(); }, { passive: false });
    elKey.addEventListener('touchend', e => { e.preventDefault(); sigOff(); }, { passive: false });

    // 키보드(스페이스바) — ② 화면이 보일 때만
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && !e.repeat && document.getElementById('screen-telegraph').classList.contains('active')) {
        e.preventDefault(); sigOn();
      }
    });
    document.addEventListener('keyup', e => {
      if (e.code === 'Space' && document.getElementById('screen-telegraph').classList.contains('active')) {
        e.preventDefault(); sigOff();
      }
    });

    // 모드 탭
    $('tgModeTabs').addEventListener('click', e => {
      const t = e.target.closest('.mode-tab'); if (t) setMode(t.dataset.mode);
    });

    // 컨트롤
    $('tgClear').onclick = reset;
    $('tgChBtn').onclick = toggleCh;
    $('tgSound').onclick = () => {
      soundOn = !soundOn;
      $('tgSoundTxt').textContent = soundOn ? '소리 켜짐' : '소리 꺼짐';
      const ic = $('tgSoundIc');
      ic.style.display = '';
      ic.src = soundOn ? 'assets/icons/sound.svg' : 'assets/icons/mute.svg';
      ic.onerror = () => { ic.style.display = 'none'; };
    };
    $('tgSpeed').oninput = function () {
      tm = M.timingModel(this.value);
      $('tgSpeedV').textContent = this.value + 'ms';
      updMark();
    };
    // 해독 메시지를 ⑤ 신호확인으로 보내기 (+ 통계 기록)
    $('tgSend').onclick = () => {
      if (mode === 'ko') composer.flush();
      const text = (mode === 'ko' ? composer.getFullText() : decoded).trim();
      if (!text) { alert('먼저 메시지를 입력하세요!'); return; }
      global.Booth.confirmMessage(text, mode, 'telegraph');
    };
  }

  global.Telegraph = { init };
})(window);

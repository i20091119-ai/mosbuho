/* ============================================================================
 * telegraph.js — ⑤ 전신키 입력 화면 (추상 단계)
 * ----------------------------------------------------------------------------
 * 전신키 입력 위젯은 morse-key.js(createMorseKey) 공용 컴포넌트 사용.
 * 이 파일은 언어 모드·참조표·해독 메시지 누적·챌린지·소리/속도 컨트롤을 담당.
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.Morse;

  let mode = 'en', soundOn = true;
  let decoded = '', composer = new M.HangulComposer();
  let key = null;
  let chOn = false, chWord = '', chIdx = 0;

  const CH_EN = ['SOS', 'HI', 'OK', 'HELLO', 'MORSE', 'CODE'];
  const CH_KO = ['ㅅㅏㄹㅏㅇ', 'ㅎㅏㄴㄱㅡㄹ', 'ㅁㅗㅅㅡ', 'ㅅㅜㅎㅏㄱ', 'ㅎㅣㅁ'];
  const REF_CHARS = {
    en: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    ko: ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ','ㅏ','ㅑ','ㅓ','ㅕ','ㅗ','ㅛ','ㅜ','ㅠ','ㅡ','ㅣ','ㅐ','ㅔ'],
    num: '1234567890'.split('')
  };
  function $(id) { return document.getElementById(id); }

  function buildRef() {
    const el = $('tgRef');
    el.className = 'ref-grid ' + mode;
    const rev = M.getRev(mode);
    const chars = mode === 'sym' ? Object.values(M.SYM) : REF_CHARS[mode];
    el.innerHTML = chars.map(ch => `<div class="ref-cell" data-ch="${ch}"><div class="rl">${ch}</div>
      <div class="shapes sm">${M.morseToShapesHTML(rev[ch] || '')}</div></div>`).join('');
    const titles = { en: '모스부호 표 (영어)', ko: '모스부호 표 (한글)', num: '모스부호 표 (숫자)', sym: '모스부호 표 (기호)' };
    $('tgRefTitle').textContent = titles[mode];
  }
  function highlightRef(ch) {
    $('tgRef').querySelectorAll('.ref-cell').forEach(c => c.classList.toggle('hl', c.dataset.ch === ch));
  }
  function renderDecoded() {
    $('tgDecoded').innerHTML = decoded || '<span class="ph">여기에 해독 결과가 나타나요</span>';
  }

  // MorseKey 콜백: 한 글자 해독
  function onChar(ch) {
    if (mode === 'ko') { composer.feed(ch); decoded = composer.getFullText(); }
    else decoded += ch;
    highlightRef(ch); renderDecoded();
    if (chOn && chWord && chWord[chIdx] === ch) { chIdx++; renderCh(); }
  }
  function onWord() {
    if (mode === 'ko') { composer.flush(); composer.committed += ' '; decoded = composer.getFullText(); }
    else decoded += ' ';
    renderDecoded();
  }

  function reset() {
    decoded = ''; chIdx = 0; composer = new M.HangulComposer();
    if (key) key.reset();
    renderDecoded(); highlightRef('');
    if (chOn) renderCh();
  }
  function setMode(m) {
    mode = m;
    $('tgModeTabs').querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === m));
    if (key) key.setMode(m);
    buildRef(); reset();
  }

  // 챌린지
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
      const c = chWord[i], cls = i < chIdx ? 'done' : i === chIdx ? 'cur' : '';
      const col = i < chIdx ? 'var(--ok)' : i === chIdx ? 'var(--brand)' : 'var(--muted)';
      h += `<div class="ch-card ${cls}"><div class="cl" style="color:${col}">${c}</div>
        <div class="shapes sm">${M.morseToShapesHTML(rev[c] || '')}</div>
        ${i < chIdx ? '<img class="ic ic-color" src="assets/icons/check.svg" alt="완료" onerror="this.style.display=\'none\'">' : ''}</div>`;
    }
    h += '</div>';
    if (chIdx >= chWord.length) {
      h += `<div style="text-align:center;margin-top:12px;color:var(--ok);font-weight:800;font-size:18px">
        <img class="ic ic-color" src="assets/icons/success.svg" alt="" onerror="this.style.display='none'">"${chWord}" 전송 성공!
        <button class="btn sm ok" id="tgChNext" style="margin-left:8px">다음 →</button></div>`;
    }
    $('tgChArea').innerHTML = h;
    const nx = $('tgChNext'); if (nx) nx.onclick = nextCh;
  }

  function init() {
    key = global.createMorseKey($('tgKeyHost'), { mode, unit: 200, sound: soundOn, onChar, onWord });
    buildRef(); renderDecoded();

    $('tgModeTabs').addEventListener('click', e => {
      const t = e.target.closest('.mode-tab'); if (t) setMode(t.dataset.mode);
    });
    $('tgClear').onclick = reset;
    $('tgChBtn').onclick = toggleCh;
    $('tgSound').onclick = () => {
      soundOn = !soundOn; key.setSound(soundOn);
      $('tgSoundTxt').textContent = soundOn ? '소리 켜짐' : '소리 꺼짐';
      const ic = $('tgSoundIc'); ic.style.display = '';
      ic.src = soundOn ? 'assets/icons/sound.svg' : 'assets/icons/mute.svg';
      ic.onerror = () => { ic.style.display = 'none'; };
    };
    $('tgSpeed').oninput = function () {
      key.setUnit(+this.value); $('tgSpeedV').textContent = this.value + 'ms';
    };
    $('tgSend').onclick = () => {
      if (mode === 'ko') { composer.flush(); decoded = composer.getFullText(); }
      const text = decoded.trim();
      if (!text) { alert('먼저 메시지를 입력하세요!'); return; }
      global.Booth.confirmMessage(text, mode, 'telegraph');
    };
  }

  global.Telegraph = { init };
})(window);

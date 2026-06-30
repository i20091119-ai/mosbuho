/* ============================================================================
 * app.js — 셸: 화면 전환 · 흐름 제어 · 공통 메시지 버스 · 팔찌 안내 · 리셋
 * ----------------------------------------------------------------------------
 * 가이드 흐름: ①학년 → ②이야기 → ③미션 → ④전신키 → ⑤카메라 → ⑥팔찌 → ⑦신호확인 → ⑧마무리
 * 시차 운영을 위해 상단 네비로 자유 이동 가능. "처음으로"로 명확히 리셋.
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.Morse;

  // ── 공통 메시지 버스 ──
  const Booth = {
    grade: null, mode: 'en', lastMessage: null,
    _listeners: [],
    onMessage(cb) { this._listeners.push(cb); },
    // ④전신키/⑤카메라에서 확정한 메시지 → 팔찌 안내 + 통계 + 아두이노 전달
    confirmMessage(text, mode, source) {
      text = (text || '').trim(); if (!text) return;
      const morse = M.textToMorse(text, mode);
      this.lastMessage = { text, mode, morse, source };
      if (global.Stats) global.Stats.record({ text, mode, source, ts: Date.now() });
      this._listeners.forEach(cb => { try { cb(text, mode, source); } catch (e) {} });
      renderBracelet();
      showScreen('bracelet');
    },
    resetAll() {
      this.lastMessage = null; this.grade = null;
      if (global.Story) global.Story.reset();
      renderBracelet();
      showScreen('grade');
    }
  };
  global.Booth = Booth;

  // ── 화면 전환 ──
  const screenMods = {};
  function registerScreen(id, hooks) { screenMods[id] = hooks; }
  global.registerScreen = registerScreen;

  let current = 'grade';
  function showScreen(id) {
    if (id === current) return;
    const prev = screenMods[current];
    if (prev && prev.onHide) { try { prev.onHide(); } catch (e) {} }
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-' + id);
    if (el) el.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === id));
    current = id;
    const next = screenMods[id];
    if (next && next.onShow) { try { next.onShow(); } catch (e) {} }
    resetIdle();
  }
  global.showScreen = showScreen;

  document.getElementById('nav').addEventListener('click', e => {
    const btn = e.target.closest('.nav-btn');
    if (btn) showScreen(btn.dataset.screen);
  });
  document.getElementById('navReset').onclick = () => Booth.resetAll();

  // ── 브랜드 모티프(학년 화면 상단) ──
  function buildMotif() {
    const motif = document.getElementById('homeMotif');
    if (!motif) return;
    const pat = ['dot', 'dash', 'dot', 'dash', 'dash', 'dot'];
    motif.innerHTML = pat.map(p => p === 'dot'
      ? '<span class="m-dot" style="width:22px;height:22px"></span>'
      : '<span class="m-dash" style="width:58px;height:22px;border-radius:11px"></span>').join('');

    // 손그림풍 떠다니는 장식 (학년 화면 히어로)
    const hero = document.querySelector('#screen-grade .home-hero');
    if (hero && !hero.querySelector('.hero-deco')) {
      const deco = document.createElement('div');
      deco.className = 'hero-deco';
      deco.setAttribute('aria-hidden', 'true');
      deco.innerHTML = ['star d1', 'sparkle d2', 'rocket d3', 'planet d4', 'sparkle d5', 'star d6']
        .map(s => { const f = s.split(' ')[0]; return `<img class="doodle ${s.split(' ')[1]}" src="assets/deco/${f}.svg" alt="" onerror="this.remove()">`; })
        .join('');
      hero.appendChild(deco);
    }
  }

  // 모스 문자열 → 좌→우 비즈 HTML. 점=짧은 비즈, 대시=긴 비즈(길이로 구분, 색은 자유),
  // 글자 끝=흰색 1개, 단어 끝=흰색 2개 (실물 팔찌엔 빈칸이 없으니 흰색 비즈로 글자를 구분).
  function morseToBeadsHTML(morse) {
    return (morse || '').split('').map(c => {
      if (c === '.') return '<span class="bead-big dot" title="점=짧은 비즈"></span>';
      if (c === '-') return '<span class="bead-big dash" title="대시=긴 비즈"></span>';
      if (c === ' ') return '<span class="bead-big white" title="글자 끝=흰색 비즈"></span>';
      if (c === '/') return '<span class="bead-big white" title="단어 끝=흰색 2개"></span><span class="bead-big white"></span>';
      return '';
    }).join('');
  }
  Booth.morseToBeadsHTML = morseToBeadsHTML;

  // ── ⑥ 팔찌 안내 ──
  function renderBracelet() {
    const host = document.getElementById('braceletView');
    if (!host) return;
    const msg = Booth.lastMessage;
    if (!msg) {
      host.innerHTML = '<p style="color:var(--muted)">아직 확정한 배열이 없어요. ④전신키나 ⑤카메라에서 메시지를 확정하면 여기에 배열이 나타나요.</p>';
      return;
    }
    const beads = morseToBeadsHTML(msg.morse);
    host.innerHTML = `
      <div class="bracelet-msg">내 메시지: <b>${escapeHtml(msg.text)}</b> <span class="mono" style="color:var(--muted)">(${M.morseToGlyphs(msg.morse.replace(/ /g,'  ').replace(/\//g,' / '))})</span></div>
      <div class="bracelet-string">${beads}</div>
      <p style="color:var(--ink-soft);margin-top:12px">왼쪽부터 순서대로 끈에 꿰어요. <b>짧은 비즈=점</b>, <b>긴 비즈=대시</b>, <b style="color:#5b6470">흰색=글자 끝</b>(단어 끝은 흰색 2개). <b>색은 자유! 길이로 구분해요.</b> 화면 순서 그대로 꿰면 돼요!</p>`;
  }
  function escapeHtml(s) { return (s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

  // ── 화면 꺼짐 방지 + 무입력 복귀 ──
  let wakeLock = null;
  async function keepAwake() { try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {} }
  let idleTimer = null;
  const IDLE_MS = 240000; // 4분 무입력 → 처음으로
  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (current !== 'grade') Booth.resetAll(); }, IDLE_MS);
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, resetIdle, { passive: true }));

  // ── 부팅 ──
  function boot() {
    buildMotif();
    if (global.Stats) global.Stats.init();
    if (global.Story) global.Story.init();
    if (global.Telegraph) global.Telegraph.init();
    if (global.Camera) global.Camera.init();
    if (global.Arduino) global.Arduino.init();

    // 흐름 이동 버튼
    const bn = document.getElementById('braceletNext');
    if (bn) bn.onclick = () => showScreen('arduino');
    const an = document.getElementById('ardNext');
    if (an) an.onclick = () => showScreen('finish');

    // 직접 네비 점프 대비 onShow 핸들러
    if (global.Story) {
      registerScreen('story', { onShow: global.Story.onShowStory });
      registerScreen('mission', { onShow: global.Story.onShowMission });
      registerScreen('finish', { onShow: global.Story.onShowFinish });
    }
    registerScreen('grade', { onShow: buildMotif });

    renderBracelet();
    keepAwake();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
    resetIdle();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);

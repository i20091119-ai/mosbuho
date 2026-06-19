/* ============================================================================
 * app.js — 부스앱 셸: 화면 전환 · 홈 · 모듈 조율 · 공통 메시지 버스
 * ----------------------------------------------------------------------------
 * 화면 순서(인지 사다리): 홈 → ②전신키(추상) → ③카메라(반실물) → ⑤신호확인(실물) → 통계
 * 해설사가 학생을 시차 운영하므로 화면 이동을 빠르고 직관적으로.
 * ==========================================================================*/
(function (global) {
  'use strict';

  // ── 공통 메시지 버스 ──────────────────────────────────────────────────────
  // ②전신키/③카메라에서 확정한 메시지를 ⑤아두이노로 전달하고 통계에 기록.
  const Booth = {
    _listeners: [],
    onMessage(cb) { this._listeners.push(cb); },
    // text: 해독 문자열, mode: 'en'|'ko'|'num'|'sym', source: 'telegraph'|'camera'
    confirmMessage(text, mode, source) {
      text = (text || '').trim();
      if (!text) return;
      // 통계 기록 (개인정보 없이 메시지만)
      if (global.Stats) global.Stats.record({ text, mode, source, ts: Date.now() });
      // 아두이노 화면으로 전달
      this._listeners.forEach(cb => { try { cb(text, mode, source); } catch (e) {} });
      // 자동 이동
      showScreen('arduino');
    }
  };
  global.Booth = Booth;

  // ── 화면 전환 ──────────────────────────────────────────────────────────────
  const screenMods = {}; // screen id → { onShow, onHide }
  function registerScreen(id, hooks) { screenMods[id] = hooks; }
  global.registerScreen = registerScreen;

  let current = 'home';
  function showScreen(id) {
    if (id === current) return;
    const prev = screenMods[current];
    if (prev && prev.onHide) { try { prev.onHide(); } catch (e) {} }
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + id).classList.add('active');
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

  // ── 홈 화면 구성 ───────────────────────────────────────────────────────────
  function buildHome() {
    // 점·대시 모티프 (로고 색 시퀀스)
    const motif = document.getElementById('homeMotif');
    const pat = ['dot', 'dash', 'dot', 'dash', 'dash', 'dot']; // 임의의 시그니처 패턴
    motif.innerHTML = pat.map(p => p === 'dot'
      ? '<span class="m-dot" style="width:22px;height:22px"></span>'
      : '<span class="m-dash" style="width:58px;height:22px;border-radius:11px"></span>').join('');

    const cards = [
      { s: 'telegraph', no: '2', c: 'var(--c-orange)', t: '전신키 두드리기', d: '키를 짧게/길게 눌러 점·대시를 직접 만들어요.', tag: '추상', tagc: 'var(--c-orange)' },
      { s: 'camera', no: '3', c: 'var(--c-blue)', t: '카메라로 비즈 읽기', d: '트레이에 놓은 빨강·파랑 비즈를 실시간 해석.', tag: '반실물', tagc: 'var(--c-blue)' },
      { s: 'arduino', no: '5', c: 'var(--c-purple)', t: '아두이노 신호 확인', d: '완성한 메시지를 LED·부저로 출력해요.', tag: '실물', tagc: 'var(--c-purple)' },
      { s: 'stats', no: '∑', c: 'var(--c-green)', t: '데이터 통계', d: '오늘 모두가 만든 메시지를 한눈에.', tag: '수학', tagc: 'var(--c-green)' }
    ];
    document.getElementById('homeCards').innerHTML = cards.map(c => `
      <button class="home-card" data-screen="${c.s}">
        <span class="badge" style="background:${c.c}">${c.no}</span>
        <h3>${c.t}</h3>
        <p>${c.d}</p>
        <span class="ladder-tag" style="background:${c.tagc}1a;color:${c.tagc}">${c.tag}</span>
      </button>`).join('');
    document.getElementById('homeCards').addEventListener('click', e => {
      const card = e.target.closest('.home-card');
      if (card) showScreen(card.dataset.screen);
    });
  }

  // ── 화면 꺼짐 방지 + 무입력 시 홈 복귀 ──────────────────────────────────────
  let wakeLock = null;
  async function keepAwake() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
  }
  let idleTimer = null;
  const IDLE_MS = 180000; // 3분 무입력 시 홈으로 (상설 운영 대비)
  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (current !== 'home') showScreen('home'); }, IDLE_MS);
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, resetIdle, { passive: true }));

  // ── 부팅 ───────────────────────────────────────────────────────────────────
  function boot() {
    buildHome();
    if (global.Stats) global.Stats.init();
    if (global.Telegraph) global.Telegraph.init();
    if (global.Camera) global.Camera.init();
    if (global.Arduino) global.Arduino.init();
    keepAwake();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') keepAwake();
    });
    resetIdle();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);

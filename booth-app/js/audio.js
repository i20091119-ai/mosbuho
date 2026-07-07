/* ============================================================================
 * audio.js — 공통 전신음(CW 톤) 유틸
 * ----------------------------------------------------------------------------
 * 전신키(②)의 키 누름음과 아두이노(⑤) 시뮬레이션 부저음에서 공용으로 사용.
 * Web Audio API 로 680Hz sine+square 합성음 생성 (기존 트레이너 음색 보존).
 * 외부 의존성 없음 · 오프라인 동작.
 * ==========================================================================*/
(function (global) {
  'use strict';

  let ctx = null;
  let active = null; // 현재 울리는 톤 노드
  let muted = false; // 실물 부저가 연결되면 true → 화면 스피커음 끔(미션 소리 부저 전용)

  function setMuted(v) { muted = !!v; if (muted) off(); }

  function ensure() {
    if (!ctx) ctx = new (global.AudioContext || global.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 톤 시작 (수동 on/off — 전신키처럼 누르는 동안 지속)
  function on() {
    if (muted) return;   // 부저 연결 시 스피커음 억제
    ensure();
    if (active) return;
    const t = ctx.currentTime;
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 680;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 680;
    const g1 = ctx.createGain(); g1.gain.value = 0.12;
    const g2 = ctx.createGain(); g2.gain.value = 0.018;
    const m = ctx.createGain();
    o1.connect(g1); g1.connect(m); o2.connect(g2); g2.connect(m); m.connect(ctx.destination);
    m.gain.setValueAtTime(0.001, t);
    m.gain.exponentialRampToValueAtTime(1.0, t + 0.005);
    o1.start(t); o2.start(t);
    active = { o1, o2, m };
  }

  function off() {
    if (!active) return;
    const t = ctx.currentTime;
    active.m.gain.setValueAtTime(active.m.gain.value, t);
    active.m.gain.exponentialRampToValueAtTime(0.001, t + 0.01);
    active.o1.stop(t + 0.02); active.o2.stop(t + 0.02);
    active = null;
  }

  // 지정 길이(ms)만큼 한 번 울리고 자동으로 끔 (재생 시퀀스용)
  function beep(durMs) {
    on();
    setTimeout(off, durMs);
  }

  global.CWAudio = { ensure, on, off, beep, setMuted };
})(window);

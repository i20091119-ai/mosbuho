/* ============================================================================
 * dev.js — 개발 시뮬레이션 패널 (?dev=1 일 때만 표시)
 * ----------------------------------------------------------------------------
 * 보드 없이 PC 브라우저에서 전체 체험을 검증하기 위한 도구.
 *   · 화면 빠른 이동
 *   · 아케이드 버튼(전신키) 누름/뗌 시뮬레이션 → 'mk-down'/'mk-up' 발사
 *   · 하드웨어로 나갈 명령(play_morse 등) 로그 표시
 * 프로덕션(부스)에선 URL 에 ?dev=1 이 없으면 아무것도 하지 않음.
 * ==========================================================================*/
(function (global) {
  'use strict';
  if (!new URLSearchParams(location.search).has('dev')) return;

  const panel = document.createElement('div');
  panel.id = 'devPanel';
  panel.innerHTML = `
    <style>
      #devPanel{position:fixed;right:10px;bottom:10px;z-index:9999;width:280px;
        background:#11151c;color:#cfe;border:1px solid #2a3340;border-radius:12px;
        font:12px/1.4 'IBM Plex Mono',monospace;box-shadow:0 8px 24px rgba(0,0,0,.4)}
      #devPanel h4{margin:0;padding:8px 12px;background:#1b2330;border-radius:12px 12px 0 0;
        font-size:12px;letter-spacing:1px;color:#9fd}
      #devPanel .body{padding:10px 12px;display:flex;flex-direction:column;gap:8px}
      #devPanel .row{display:flex;gap:6px;flex-wrap:wrap}
      #devPanel button{background:#222c3a;color:#cfe;border:1px solid #34404f;border-radius:6px;
        padding:5px 8px;font:11px/1 'IBM Plex Mono',monospace;cursor:pointer}
      #devPanel button:hover{border-color:#5aa9e6}
      #devPanel .key{background:#3a2a10;border-color:#7a5;color:#fe9;flex:1;padding:10px;font-weight:700}
      #devPanel .log{background:#0b0e13;border:1px solid #222c3a;border-radius:6px;height:120px;
        overflow:auto;padding:6px 8px;color:#8fb;white-space:pre-wrap}
      #devPanel .mut{color:#6a7a8a}
    </style>
    <h4>DEV · 시뮬레이션</h4>
    <div class="body">
      <div class="mut">화면 이동</div>
      <div class="row" id="devNav"></div>
      <div class="mut">전신키(아케이드 버튼)</div>
      <button class="key" id="devKey">꾹 눌러서 모스 입력 (누르는 동안 신호)</button>
      <div class="mut">하드웨어로 나갈 명령 로그</div>
      <div class="log" id="devLog"></div>
    </div>`;
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(panel));
  if (document.readyState !== 'loading') document.body.appendChild(panel);

  function log(msg) {
    const el = document.getElementById('devLog'); if (!el) return;
    const t = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    el.textContent += `[${t}] ${msg}\n`;
    el.scrollTop = el.scrollHeight;
  }

  function build() {
    // 화면 이동 버튼
    const nav = document.getElementById('devNav');
    [['grade','학년'],['story','이야기'],['mission','미션'],['telegraph','전신키'],
     ['camera','카메라'],['bracelet','팔찌'],['arduino','신호'],['finish','마무리'],['stats','통계']]
      .forEach(([id, label]) => {
        const b = document.createElement('button'); b.textContent = label;
        b.onclick = () => global.showScreen && global.showScreen(id);
        nav.appendChild(b);
      });
    // 전신키 시뮬: 누르는 동안 mk-down, 떼면 mk-up
    const key = document.getElementById('devKey');
    const down = e => { e.preventDefault(); document.dispatchEvent(new Event('mk-down')); log('버튼 ▼ down'); };
    const up = e => { e.preventDefault(); document.dispatchEvent(new Event('mk-up')); log('버튼 ▲ up'); };
    key.addEventListener('pointerdown', down);
    key.addEventListener('pointerup', up);
    key.addEventListener('pointerleave', e => { if (e.buttons) up(e); });
    log('dev 모드 시작. 스페이스바로도 전신키 입력 가능.');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else setTimeout(build, 0);

  // 하드웨어로 나갈 명령 수신 (arduino.js 등이 발사)
  document.addEventListener('hw-cmd', e => {
    const d = e.detail || {};
    log(`→ ${d.cmd}(${JSON.stringify(d.args || d).replace(/[{}"]/g, '')})  [${d.mode || ''}]`);
  });

  global.__dev = { log };
})(window);

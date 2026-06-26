/* ============================================================================
 * camera.js — ⑤ 웹캠 비즈 인식 (반실물 단계, 앱 핵심 기능)
 * ----------------------------------------------------------------------------
 * 방식: **길이 기반**. 색이 아니라 비즈 길이로 점/대시를 구분한다.
 *   - 비즈 사이 작은 틈(어두운 배경)으로 비즈를 분리 → 같은 색이 붙어도 구분됨
 *   - 짧은 비즈 = 점(·), 긴 비즈 = 대시(—)  (길이 임계값으로 판정)
 *   - 흰색 비즈(채도 낮음) = 글자 구분(공백)  ※ 다른 비즈엔 흰색 안 씀
 *   - 색은 자유(같은 색 인접 가능). 트레이는 어두운 색이어야 틈·흰색이 보임.
 * 외부 라이브러리 없이 순수 JS: getUserMedia → <canvas> 픽셀 분석 →
 *   열(column) 라벨(배경/색/흰색) → 틈으로 비즈 분리 → 길이로 점/대시 → 디코딩.
 * 길이 보정: 짧은(점)·긴(대시) 비즈를 한 번씩 찍어 픽셀 길이 기준을 저장(고정 부스용).
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.Morse;

  // ── 분석 파라미터 ──────────────────────────────────────────────────────────
  const PROC_W = 200;            // 처리 해상도 폭(px) — 속도/정확도 균형
  const SAT_MIN = 0.30;          // 채도 하한(색 비즈 인정). 보정으로 조정 가능
  const VAL_MIN = 0.18;          // 명도 하한(어두운 트레이/그림자 제거)
  const COL_RATIO = 0.12;        // 한 열이 '비즈'로 인정되는 최소 픽셀 비율
  const MIN_RUN = 3;             // 노이즈 제거: 최소 비즈 폭(px)
  const WHITE_SAT_MAX = 0.22;    // 이하 채도 = 흰/회색(구분자 후보)
  const WHITE_VAL_MIN = 0.55;    // 이상 명도 = 밝음(흰색 비즈)
  const ROI = { x0: 0.08, x1: 0.92, y0: 0.30, y1: 0.70 }; // 인식 영역(화면 비율)

  // 보정값 — satMin(색 채도하한) + 길이 기준(점/대시)
  let calib = { satMin: SAT_MIN, dotLen: 0, dashLen: 0 };

  // 상태
  let stream = null, raf = null, running = false;
  let video, overlay, octx, proc, pctx;
  let cmode = 'en';
  let lastResult = '';   // 마지막 표시 결과(안정화용)
  let stableCount = 0, pending = '';
  let confirmedText = '', confirmedMorse = '';

  function $(id) { return document.getElementById(id); }

  // ── RGB → HSV ──────────────────────────────────────────────────────────
  function rgb2hsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d !== 0) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    const s = mx === 0 ? 0 : d / mx;
    return [h, s, mx];
  }

  // ── 카메라 시작/정지 ─────────────────────────────────────────────────────
  async function start() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false
      });
      video.srcObject = stream;
      await video.play();
      running = true;
      $('camMsg').style.display = 'none';
      ['camStop', 'camCalibDot', 'camCalibDash', 'camReset', 'camConfirm'].forEach(id => { const e = $(id); if (e) e.disabled = false; });
      loop();
    } catch (e) {
      $('camMsg').innerHTML = '<img class="ic-lg" src="assets/icons/camera-off.svg" alt="" onerror="this.style.display=\'none\'"><div>카메라를 열 수 없습니다.<br>권한을 허용했는지, UNO Q에 웹캠이 연결됐는지 확인하세요.</div>';
    }
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    $('camMsg').style.display = 'flex';
    $('camMsg').innerHTML = '<img class="ic-lg" src="assets/icons/camera.svg" alt="" onerror="this.style.display=\'none\'"><div>카메라가 꺼졌습니다</div><button class="btn primary" id="camStart">카메라 켜기</button>';
    $('camStart').onclick = start;
    ['camStop', 'camCalibDot', 'camCalibDash', 'camReset', 'camConfirm'].forEach(id => { const e = $(id); if (e) e.disabled = true; });
  }

  // ── ROI 픽셀을 처리 캔버스로 가져오기 ──────────────────────────────────────
  function grabROI() {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    const sx = vw * ROI.x0, sw = vw * (ROI.x1 - ROI.x0);
    const sy = vh * ROI.y0, sh = vh * (ROI.y1 - ROI.y0);
    const w = PROC_W, h = Math.max(1, Math.round(PROC_W * sh / sw));
    proc.width = w; proc.height = h;
    pctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    return pctx.getImageData(0, 0, w, h);
  }

  // ── 비즈 검출: 열 라벨(배경/색/흰색) → 틈으로 분리 ─────────────────────────
  //   반환: [{type:'color'|'white', x0, x1}]  (좌→우 순서)
  function detectBeads(img) {
    const { data, width: w, height: h } = img;
    const need = Math.max(2, Math.round(h * COL_RATIO));
    const labels = new Array(w).fill(0); // 0 배경, 1 색비즈, 2 흰색
    for (let x = 0; x < w; x++) {
      let colorN = 0, whiteN = 0;
      for (let y = 0; y < h; y++) {
        const i = (y * w + x) * 4;
        const [hue, s, v] = rgb2hsv(data[i], data[i + 1], data[i + 2]);
        if (v < VAL_MIN) continue;                              // 어두운 배경(트레이) 제거
        if (s < WHITE_SAT_MAX && v >= WHITE_VAL_MIN) whiteN++;  // 흰색 비즈(구분자)
        else if (s >= calib.satMin) colorN++;                   // 채도 있는 색 비즈
      }
      if (colorN >= need && colorN >= whiteN) labels[x] = 1;
      else if (whiteN >= need) labels[x] = 2;
    }
    // 틈(배경)으로 비즈 분리 — 색이 같아도 틈만 있으면 구분됨. 색↔흰 전환도 분리.
    const GAP = Math.max(2, Math.round(w * 0.012));
    const beads = []; let cur = null, gap = 0;
    const close = () => { if (cur) { beads.push(cur); cur = null; } };
    for (let x = 0; x < w; x++) {
      const L = labels[x];
      if (L === 0) { gap++; if (cur && gap > GAP) close(); continue; }
      gap = 0;
      const type = L === 2 ? 'white' : 'color';
      if (cur && cur.type === type) cur.x1 = x;
      else { close(); cur = { type, x0: x, x1: x }; }
    }
    close();
    return beads.filter(b => (b.x1 - b.x0 + 1) >= MIN_RUN);
  }

  // 색 비즈 길이 → 점(짧)/대시(김) 임계값
  function lengthThreshold(lens) {
    if (calib.dotLen && calib.dashLen) return (calib.dotLen + calib.dashLen) / 2;  // 보정값 우선(고정 부스)
    if (!lens.length) return Infinity;
    const mn = Math.min.apply(null, lens), mx = Math.max.apply(null, lens);
    if (mx / mn >= 1.8) return Math.sqrt(mn * mx);   // 둘 다 있음 → 기하 중간값(대시=3배라 안전)
    return Infinity;                                  // 길이 다 비슷 → 전부 점(보정 권장)
  }

  // 비즈 → 모스 → 글자  (흰색=글자 구분, 길이=점/대시)
  function analyzeImg(img) {
    const beads = detectBeads(img);
    if (!beads.length) return { beads: [], morse: '', text: '' };
    const lens = beads.filter(b => b.type === 'color').map(b => b.x1 - b.x0 + 1);
    const thr = lengthThreshold(lens);
    let morse = '';
    for (const b of beads) {
      if (b.type === 'white') { if (morse && !morse.endsWith(' ')) morse += ' '; }
      else { b.dot = (b.x1 - b.x0 + 1) < thr; morse += b.dot ? '.' : '-'; }
    }
    morse = morse.trim();
    return { beads, morse, text: decodeMorse(morse) };
  }

  function analyze() {
    const img = grabROI();
    if (!img) return null;
    return analyzeImg(img);
  }

  function decodeMorse(morse) {
    const letters = morse.trim().split(/\s+/).filter(Boolean);
    if (cmode === 'ko') {
      const comp = new M.HangulComposer();
      letters.forEach(l => comp.feed(M.decode(l, 'ko')));
      comp.flush();
      return comp.committed;
    }
    return letters.map(l => M.decode(l, cmode)).join('');
  }

  // ── 오버레이(검출 박스) ───────────────────────────────────────────────────
  function drawOverlay(beads, w) {
    overlay.width = overlay.clientWidth; overlay.height = overlay.clientHeight;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    if (!beads || !beads.length) return;
    const ow = overlay.width, oh = overlay.height;
    const rx0 = ROI.x0 * ow, rw = (ROI.x1 - ROI.x0) * ow;
    const ry = ROI.y0 * oh, rh = (ROI.y1 - ROI.y0) * oh;
    beads.forEach(b => {
      const x = rx0 + (b.x0 / w) * rw;
      const bw = ((b.x1 - b.x0 + 1) / w) * rw;
      octx.strokeStyle = b.type === 'white' ? '#cfd4da' : (b.dot ? '#E8943D' : '#3D8FE8');
      octx.lineWidth = 3;
      octx.strokeRect(x, ry, bw, rh);
    });
  }

  // ── 메인 루프 (안정화: 동일 결과 2프레임 지속 시 확정 표시) ──────────────────
  let lastTick = 0;
  function loop() {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    if (now - lastTick < 140) return; // ~7fps 분석 (성능)
    lastTick = now;

    const res = analyze();
    if (!res) return;
    drawOverlay(res.beads, proc.width);

    if (res.morse === pending) stableCount++;
    else { pending = res.morse; stableCount = 0; }

    if (stableCount >= 1 && res.morse !== lastResult) {
      lastResult = res.morse;
      confirmedMorse = res.morse; confirmedText = res.text;
      renderReadout(res);
    }
  }

  function beadLabel(b) {
    if (b.type === 'white') return '<span class="bead sep">흰·글자끝</span>';
    return b.dot ? '<span class="bead dot">짧은·점</span>' : '<span class="bead dash">긴·대시</span>';
  }

  function renderReadout(res) {
    const beadsEl = $('camBeads');
    if (!res.beads.length) { beadsEl.innerHTML = '<span style="color:var(--muted);font-size:13px">아직 없음</span>'; }
    else { beadsEl.innerHTML = res.beads.map(beadLabel).join(''); }
    $('camMorse').textContent = M.morseToGlyphs(res.morse.replace(/ /g, '  '));
    $('camText').textContent = res.text || '';
    $('camConfirm').disabled = !res.text;
    renderAlgo(res);
  }

  // 인식 과정을 한 단계씩 가시화 (복호화가 절차=알고리즘임을 체득)
  function renderAlgo(res) {
    const el = $('camAlgo'); if (!el) return;
    if (!res.beads.length) { el.innerHTML = '<span style="color:var(--muted);font-size:13px">비즈를 인식하면 한 단계씩 보여줘요</span>'; return; }
    let h = '';
    res.beads.forEach((b, i) => {
      let name, sym, col;
      if (b.type === 'white') { name = '흰색 비즈'; sym = '글자 끝(띄움)'; col = 'var(--muted)'; }
      else if (b.dot) { name = '짧은 비즈'; sym = '점(·)'; col = 'var(--dot)'; }
      else { name = '긴 비즈'; sym = '대시(—)'; col = 'var(--dash)'; }
      h += `<div class="algo-step">
        <span class="algo-n">${i + 1}</span>
        <span>${i + 1}번째: <b style="color:${col}">${name}</b> → <b>${sym}</b></span></div>`;
    });
    h += `<div class="algo-step done"><span class="algo-n">✓</span>
      <span>좌→우로 모두 읽음 → 모스 <b class="mono">${M.morseToGlyphs(res.morse)}</b> → 글자 <b>${res.text || '?'}</b></span></div>`;
    el.innerHTML = h;
  }

  // ── 길이 보정: ROI 가운데에 비즈 1개를 두고 그 길이를 점/대시 기준으로 저장 ──
  function calibrate(which) { // 'dot' | 'dash'
    const img = grabROI();
    if (!img) return;
    const beads = detectBeads(img).filter(b => b.type === 'color');
    if (!beads.length) { setCalibMsg('비즈가 안 보여요. ROI 가운데에 비즈 1개를 크게 두고 다시 보정하세요.'); return; }
    const len = Math.max.apply(null, beads.map(b => b.x1 - b.x0 + 1)); // 가장 긴 색 비즈(노이즈 방지)
    if (which === 'dot') calib.dotLen = len; else calib.dashLen = len;
    const both = calib.dotLen && calib.dashLen;
    setCalibMsg(`${which === 'dot' ? '짧은(점)' : '긴(대시)'} 비즈 길이 보정 완료 (${len}px).` +
      (both ? ` 점/대시 기준 = ${Math.round((calib.dotLen + calib.dashLen) / 2)}px. 인식 준비 완료!`
            : ' 나머지(' + (which === 'dot' ? '긴' : '짧은') + ') 비즈도 보정하세요.'));
  }
  function setCalibMsg(msg) { const e = $('camCalibState'); if (e) e.textContent = msg; }

  function resetRecognition() {
    lastResult = ''; pending = ''; stableCount = 0; confirmedText = ''; confirmedMorse = '';
    renderReadout({ beads: [], morse: '', text: '' });
  }

  // ── 초기화 ─────────────────────────────────────────────────────────────
  function init() {
    video = $('camVideo'); overlay = $('camOverlay'); octx = overlay.getContext('2d');
    proc = document.createElement('canvas'); pctx = proc.getContext('2d', { willReadFrequently: true });

    $('camStart').onclick = start;
    $('camStop').onclick = stop;
    const cd = $('camCalibDot'); if (cd) cd.onclick = () => calibrate('dot');
    const cda = $('camCalibDash'); if (cda) cda.onclick = () => calibrate('dash');
    $('camReset').onclick = resetRecognition;
    $('camConfirm').onclick = () => {
      if (!confirmedText) return;
      global.Booth.confirmMessage(confirmedText, cmode, 'camera');
    };
    // 모드 탭
    document.querySelectorAll('#screen-camera [data-cmode]').forEach(t => {
      t.onclick = () => {
        cmode = t.dataset.cmode;
        document.querySelectorAll('#screen-camera [data-cmode]').forEach(x => x.classList.toggle('active', x === t));
        resetRecognition();
      };
    });

    // 화면을 벗어나면 카메라를 끄고 배터리/프라이버시 보호
    global.registerScreen && global.registerScreen('camera', { onHide: () => { if (running) stop(); } });
  }

  // 테스트 훅(synthetic ImageData 로 인식 로직 검증용)
  global.Camera = { init, _analyzeImg: analyzeImg, _setCalib: c => Object.assign(calib, c) };
})(window);

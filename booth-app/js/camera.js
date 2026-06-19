/* ============================================================================
 * camera.js — ③ 웹캠 비즈 색 인식 + 조명 보정 (반실물 단계, 앱 핵심 기능)
 * ----------------------------------------------------------------------------
 * 방식: 색(HSV Hue) 기반 분류. 길이가 아니라 색으로 점/대시 구분.
 *   채도(S)로 배경 제거 → 색상(H)으로 빨강/파랑 판정 → 좌→우 순서로 읽어 모스 생성.
 *   빨강 비즈 = 점(·), 파랑 비즈 = 대시(—).
 * 외부 라이브러리 없이 순수 JS: getUserMedia → <canvas> 픽셀 분석 →
 *   열(column) 단위 색 라벨 → 좌→우 연결요소(run) 검출 → 글자/단어 그룹핑 → 디코딩.
 * 조명 보정: 현재 조명에서 빨강·파랑 샘플을 한 번 찍어 기준 Hue 범위 재설정(30초).
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.Morse;

  // ── 분석 파라미터 (조명 보정으로 갱신) ──────────────────────────────────
  const PROC_W = 200;            // 처리 해상도 폭(px) — 속도/정확도 균형
  const SAT_MIN = 0.30;          // 채도 하한(배경 제거). 보정으로 조정 가능
  const VAL_MIN = 0.18;          // 명도 하한(그림자 제거)
  const COL_RATIO = 0.12;        // 한 열이 '색'으로 인정되는 최소 픽셀 비율
  const MIN_RUN = 3;             // 노이즈 제거: 최소 run 폭(px)
  const LETTER_GAP_FACTOR = 1.6; // 평균 비즈폭 × 이 값 이상 간격이면 글자 경계
  const ROI = { x0: 0.08, x1: 0.92, y0: 0.30, y1: 0.70 }; // 인식 영역(화면 비율)

  // 기준 Hue 범위 (기본값 — 밝기 ±30% 변동에도 색상 기준은 안정적)
  let calib = {
    red:  { test: h => (h < 20 || h > 340) },
    blue: { test: h => (h >= 195 && h <= 265) },
    satMin: SAT_MIN
  };

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
      ['camStop', 'camCalibRed', 'camCalibBlue', 'camReset', 'camConfirm'].forEach(id => $(id).disabled = false);
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
    ['camStop', 'camCalibRed', 'camCalibBlue', 'camReset', 'camConfirm'].forEach(id => $(id).disabled = true);
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

  // ── 열(column) 단위 색 라벨 → run 검출 → 글자 그룹 → 디코딩 ────────────────
  function analyze() {
    const img = grabROI();
    if (!img) return null;
    const { data, width: w, height: h } = img;
    const need = Math.max(2, Math.round(h * COL_RATIO));

    // 1) 열별 라벨 (R / B / none)
    const labels = new Array(w).fill(0); // 0 none, 1 red, 2 blue
    for (let x = 0; x < w; x++) {
      let rc = 0, bc = 0;
      for (let y = 0; y < h; y++) {
        const i = (y * w + x) * 4;
        const [hue, s, v] = rgb2hsv(data[i], data[i + 1], data[i + 2]);
        if (s < calib.satMin || v < VAL_MIN) continue;
        if (calib.red.test(hue)) rc++;
        else if (calib.blue.test(hue)) bc++;
      }
      if (rc >= need && rc >= bc) labels[x] = 1;
      else if (bc >= need && bc > rc) labels[x] = 2;
    }

    // 2) run(연결요소) 검출 — 색 바뀌거나 큰 공백이면 분리
    const GAP = Math.max(2, Math.round(w * 0.012));
    const runs = []; let cur = null, gap = 0;
    for (let x = 0; x < w; x++) {
      const L = labels[x];
      if (L === 0) {
        gap++;
        if (cur && gap > GAP) { runs.push(cur); cur = null; }
      } else {
        if (!cur) cur = { color: L, x0: x, x1: x };
        else if (cur.color === L) { cur.x1 = x; }
        else { runs.push(cur); cur = { color: L, x0: x, x1: x }; }
        gap = 0;
      }
    }
    if (cur) runs.push(cur);
    const beads = runs.filter(r => (r.x1 - r.x0 + 1) >= MIN_RUN);
    if (!beads.length) return { beads: [], morse: '', text: '' };

    // 3) 글자 그룹핑: 평균 비즈폭 대비 큰 간격이면 글자 경계
    const widths = beads.map(b => b.x1 - b.x0 + 1);
    const avgW = widths.reduce((a, c) => a + c, 0) / widths.length;
    let morse = '';
    for (let i = 0; i < beads.length; i++) {
      morse += beads[i].color === 1 ? '.' : '-';
      if (i < beads.length - 1) {
        const gapPx = beads[i + 1].x0 - beads[i].x1;
        if (gapPx > avgW * LETTER_GAP_FACTOR) morse += ' ';
      }
    }

    // 4) 디코딩 (모드별, 한글은 자모→음절 조합)
    const text = decodeMorse(morse);
    return { beads, morse, text };
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
      octx.strokeStyle = b.color === 1 ? '#C00018' : '#1878C0';
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

  function renderReadout(res) {
    const beadsEl = $('camBeads');
    if (!res.beads.length) { beadsEl.innerHTML = '<span style="color:var(--muted);font-size:13px">아직 없음</span>'; }
    else {
      beadsEl.innerHTML = res.beads.map(b => b.color === 1
        ? '<span class="bead red">점·</span>' : '<span class="bead blue">대시—</span>').join('');
    }
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
      const red = b.color === 1;
      h += `<div class="algo-step">
        <span class="algo-n">${i + 1}</span>
        <span>${i + 1}번째 비즈 읽는 중: <b style="color:${red ? 'var(--dot)' : 'var(--dash)'}">${red ? '빨강' : '파랑'}</b>
        → <b>${red ? '점(·)' : '대시(—)'}</b></span></div>`;
    });
    h += `<div class="algo-step done"><span class="algo-n">✓</span>
      <span>좌→우로 모두 읽음 → 모스 <b class="mono">${M.morseToGlyphs(res.morse)}</b> → 글자 <b>${res.text || '?'}</b></span></div>`;
    el.innerHTML = h;
  }

  // ── 조명 보정 ──────────────────────────────────────────────────────────
  // ROI 중앙에서 채도 높은 픽셀들의 평균 Hue 를 구해 기준 범위를 재설정.
  function calibrate(which) {
    const img = grabROI();
    if (!img) return;
    const { data, width: w, height: h } = img;
    let sum = 0, n = 0, sMin = 1;
    // 중앙 60% 영역만 샘플
    for (let y = Math.floor(h * 0.2); y < h * 0.8; y++) {
      for (let x = Math.floor(w * 0.2); x < w * 0.8; x++) {
        const i = (y * w + x) * 4;
        const [hue, s, v] = rgb2hsv(data[i], data[i + 1], data[i + 2]);
        if (s < 0.25 || v < VAL_MIN) continue;
        // 빨강은 0/360 경계라 sin/cos 평균 처리
        sum += hue; n++; if (s < sMin) sMin = s;
      }
    }
    if (n < 20) { setCalibMsg('샘플이 부족해요. 비즈를 화면 가운데 크게 보이게 두고 다시 보정하세요.'); return; }
    const center = circularMeanHue(img, which);
    const tol = 35;
    if (which === 'red') {
      calib.red = { test: h => angDist(h, center) <= tol };
    } else {
      calib.blue = { test: h => angDist(h, center) <= tol };
    }
    calib.satMin = Math.max(0.2, Math.min(SAT_MIN, sMin * 0.7));
    setCalibMsg(`${which === 'red' ? '빨강' : '파랑'} 보정 완료 — 기준 색상 ${Math.round(center)}° (허용 ±${tol}°).`);
  }
  // 원형(0–360) 평균 — 빨강 경계 안전
  function circularMeanHue(img, which) {
    const { data, width: w, height: h } = img;
    let sx = 0, sy = 0, n = 0;
    for (let y = Math.floor(h * 0.2); y < h * 0.8; y++) {
      for (let x = Math.floor(w * 0.2); x < w * 0.8; x++) {
        const i = (y * w + x) * 4;
        const [hue, s, v] = rgb2hsv(data[i], data[i + 1], data[i + 2]);
        if (s < 0.25 || v < VAL_MIN) continue;
        const rad = hue * Math.PI / 180; sx += Math.cos(rad); sy += Math.sin(rad); n++;
      }
    }
    let a = Math.atan2(sy / n, sx / n) * 180 / Math.PI; if (a < 0) a += 360; return a;
  }
  function angDist(a, b) { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
  function setCalibMsg(msg) { $('camCalibState').textContent = msg; }

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
    $('camCalibRed').onclick = () => calibrate('red');
    $('camCalibBlue').onclick = () => calibrate('blue');
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

  global.Camera = { init };
})(window);

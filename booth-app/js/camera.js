/* ============================================================================
 * camera.js — ⑤ 웹캠 비즈 인식 (반실물 단계, 앱 핵심 기능)
 * ----------------------------------------------------------------------------
 * 방식: **모양(가로÷세로 비율) 기반 · 한 번에 한 글자**. 보정이 필요 없다.
 *   - 한 화면 = 알파벳/숫자 한 글자. 글자 구분(흰색·띄움)은 쓰지 않는다.
 *   - 짧은(둥근) 비즈 = 가로≈세로(비율~1) → 점(·)
 *     긴(원통) 비즈   = 가로≈세로×3(비율~3) → 대시(—)
 *   - 비율로 판정하므로 카메라 거리·비즈 크기와 무관(스케일 불변). 보정 불필요.
 *   - 배경 분리는 **밝기(명도) + 매 프레임 Otsu 자동 임계값**. 채도(색)를 안 쓰므로
 *     흰/옅은 비즈도 잡히고, 어두운 트레이와 잘 분리된다(보정 불필요).
 *   - 비즈 사이 틈(어두운 배경)으로 비즈를 분리 → 같은 색이 붙어도 구분됨
 *   - 색은 자유(같은 색 인접 가능). 트레이는 비즈보다 어두워야 분리가 잘 된다.
 *   - 흰색 비즈는 더 이상 구분자가 아님(밝은 점으로 보임).
 * 외부 라이브러리 없이 순수 JS: getUserMedia → <canvas> 픽셀 분석 →
 *   밝기 Otsu 로 비즈/배경 분리 → 틈으로 비즈 분리 → 각 비즈 가로÷세로 비율로 점/대시 → 디코딩(한 글자).
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.Morse;

  // ── 분석 파라미터 ──────────────────────────────────────────────────────────
  const PROC_W = 200;            // 처리 해상도 폭(px) — 속도/정확도 균형
  const VAL_FLOOR = 0.30;        // 명도 절대 하한(아무리 어두워도 이보다 밝아야 비즈)
  const SEP_MIN = 40;            // 비즈/배경 밝기차(0~255) 최소 — 이보다 작으면 비즈 없음으로
  const BRIGHT_MIN = 120;        // 비즈(밝은 쪽) 평균 명도 최소 — 어두운 프레임 오검출 방지
  const COL_RATIO = 0.12;        // 한 열이 '비즈'로 인정되는 최소 픽셀 비율
  const MIN_RUN = 3;             // 노이즈 제거: 최소 비즈 폭(px)
  const ASPECT_THR = 1.9;        // 가로÷세로 ≥ 이 값이면 대시(원통), 미만이면 점(둥근)
  const ROI = { x0: 0.08, x1: 0.92, y0: 0.30, y1: 0.70 }; // 인식 영역(화면 비율)

  // 상태
  let stream = null, raf = null, running = false;
  let video, overlay, octx, proc, pctx;
  let cmode = 'en';
  let lastResult = '';   // 마지막 표시 결과(안정화용)
  let stableCount = 0, pending = '';
  let confirmedText = '', confirmedMorse = '';
  let built = [];        // 한 글자씩 누적: [{ text, morse }]  → 팔찌 만들기

  function $(id) { return document.getElementById(id); }

  // ── Otsu: 밝기 히스토그램에서 비즈/배경을 가르는 임계값 자동 산출 ──────────────
  function otsu(hist, total) {
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, maxVar = -1, thr = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (wB === 0) continue;
      const wF = total - wB; if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxVar) { maxVar = between; thr = t; }
    }
    return thr;
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
      ['camStop', 'camReset'].forEach(id => { const e = $(id); if (e) e.disabled = false; });
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
    ['camStop', 'camReset', 'camAdd'].forEach(id => { const e = $(id); if (e) e.disabled = true; });
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

  // ── 비즈 검출: 밝기(명도)로 배경 분리 → 틈으로 분리 + 각 비즈의 가로/세로 측정 ──
  //   반환: [{x0, x1, width, height}]  (좌→우 순서)
  //   색(채도) 대신 밝기를 쓰는 이유: 흰/옅은 비즈도 밝아서 잡히고, 어두운 트레이와 잘 분리됨.
  //   임계값은 매 프레임 Otsu 로 자동 결정 → 조명·배경이 달라도 보정 없이 동작.
  function detectBeads(img) {
    const { data, width: w, height: h } = img;
    const N = w * h;
    // 1) 픽셀별 명도 V(=RGB 최댓값) + 히스토그램
    const V = new Uint8Array(N);
    const hist = new Array(256).fill(0);
    for (let p = 0; p < N; p++) {
      const i = p * 4;
      const v = data[i] > data[i + 1] ? (data[i] > data[i + 2] ? data[i] : data[i + 2])
                                      : (data[i + 1] > data[i + 2] ? data[i + 1] : data[i + 2]);
      V[p] = v; hist[v]++;
    }
    // 2) Otsu 임계값 + 비즈/배경 평균 명도
    const thr = otsu(hist, N);
    let bc = 0, bs = 0, dc = 0, ds = 0;
    for (let t = 0; t < 256; t++) { if (t > thr) { bc += hist[t]; bs += t * hist[t]; } else { dc += hist[t]; ds += t * hist[t]; } }
    const brightMean = bc ? bs / bc : 0, darkMean = dc ? ds / dc : 0;
    // 비즈가 배경보다 충분히 밝지 않으면(=비즈 없음/대비 부족) 검출 안 함 → 오검출 방지
    if (brightMean - darkMean < SEP_MIN || brightMean < BRIGHT_MIN) return [];
    const T = Math.max(thr, Math.round(VAL_FLOOR * 255));  // 절대 하한도 함께 적용
    // 3) 열별 비즈 픽셀 수 → 라벨
    const need = Math.max(2, Math.round(h * COL_RATIO));
    const labels = new Array(w).fill(0);   // 0 배경, 1 비즈
    const colCount = new Array(w).fill(0); // 각 열의 비즈 픽셀 수 ≈ 그 열에서 비즈 세로 두께
    for (let x = 0; x < w; x++) {
      let beadN = 0;
      for (let y = 0; y < h; y++) { if (V[y * w + x] > T) beadN++; }
      colCount[x] = beadN;
      if (beadN >= need) labels[x] = 1;
    }
    // 틈(배경)으로 비즈 분리 — 색이 같아도 틈만 있으면 구분됨.
    const GAP = Math.max(2, Math.round(w * 0.012));
    const beads = []; let cur = null, gap = 0;
    const close = () => { if (cur) { beads.push(cur); cur = null; } };
    for (let x = 0; x < w; x++) {
      if (labels[x] === 0) { gap++; if (cur && gap > GAP) close(); continue; }
      if (cur) cur.x1 = x;
      else { close(); cur = { x0: x, x1: x }; }
      gap = 0;
    }
    close();
    // 각 비즈의 가로(폭) + 세로(두께≈지름) 측정. 세로는 열별 두께의 상위 80% 값(가장자리 노이즈 방지).
    beads.forEach(b => {
      b.width = b.x1 - b.x0 + 1;
      const cnts = [];
      for (let x = b.x0; x <= b.x1; x++) cnts.push(colCount[x]);
      cnts.sort((a, c) => a - c);
      b.height = cnts[Math.min(cnts.length - 1, Math.floor(cnts.length * 0.8))] || 1;
    });
    return beads.filter(b => b.width >= MIN_RUN);
  }

  // 비즈 → 모스 → 글자  (한 번에 한 글자: 가로÷세로 비율로 점/대시, 글자 구분 없음)
  function analyzeImg(img) {
    const beads = detectBeads(img);
    if (!beads.length) return { beads: [], morse: '', text: '' };
    let morse = '';
    beads.forEach(b => {
      b.aspect = b.width / Math.max(1, b.height);
      b.dot = b.aspect < ASPECT_THR;       // 둥근(비율<1.9)=점, 길쭉(비율≥1.9)=대시
      morse += b.dot ? '.' : '-';
    });
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
      octx.strokeStyle = b.dot ? '#E8943D' : '#3D8FE8';
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
    return b.dot ? '<span class="bead dot">짧은·점</span>' : '<span class="bead dash">긴·대시</span>';
  }

  function renderReadout(res) {
    const beadsEl = $('camBeads');
    if (!res.beads.length) { beadsEl.innerHTML = '<span style="color:var(--muted);font-size:13px">아직 없음</span>'; }
    else { beadsEl.innerHTML = res.beads.map(beadLabel).join(''); }
    $('camMorse').textContent = M.morseToGlyphs(res.morse.replace(/ /g, '  '));
    $('camText').textContent = res.text || '';
    const add = $('camAdd'); if (add) add.disabled = !res.text;
    renderAlgo(res);
  }

  // 인식 과정을 한 단계씩 가시화 (복호화가 절차=알고리즘임을 체득)
  function renderAlgo(res) {
    const el = $('camAlgo'); if (!el) return;
    if (!res.beads.length) { el.innerHTML = '<span style="color:var(--muted);font-size:13px">비즈를 인식하면 한 단계씩 보여줘요</span>'; return; }
    let h = '';
    res.beads.forEach((b, i) => {
      const name = b.dot ? '짧은 비즈' : '긴 비즈';
      const sym = b.dot ? '점(·)' : '대시(—)';
      const col = b.dot ? 'var(--dot)' : 'var(--dash)';
      h += `<div class="algo-step">
        <span class="algo-n">${i + 1}</span>
        <span>${i + 1}번째: <b style="color:${col}">${name}</b> → <b>${sym}</b></span></div>`;
    });
    h += `<div class="algo-step done"><span class="algo-n">✓</span>
      <span>좌→우로 모두 읽음 → 모스 <b class="mono">${M.morseToGlyphs(res.morse)}</b> → 글자 <b>${res.text || '?'}</b></span></div>`;
    el.innerHTML = h;
  }

  function resetRecognition() {
    lastResult = ''; pending = ''; stableCount = 0; confirmedText = ''; confirmedMorse = '';
    renderReadout({ beads: [], morse: '', text: '' });
  }

  // ── 한 글자씩 누적해 팔찌 만들기 ───────────────────────────────────────────
  // 흐름: ① 한 글자 비즈를 카메라에 → 인식 → ② '이 글자 추가' → 팔찌에 실물로 꿰기 → 반복
  function addCurrent() {
    if (!confirmedText) return;
    built.push({ text: confirmedText, morse: confirmedMorse });
    renderBuilt();
    resetRecognition();        // 다음 글자를 놓을 수 있게 현재 인식 비움
  }
  function undoLast() { if (built.length) { built.pop(); renderBuilt(); } }
  function clearBuilt() { built = []; renderBuilt(); }
  function builtText() { return built.map(b => b.text).join(''); }
  function builtMorse() { return built.map(b => b.morse).join(' '); }  // 글자 사이 = 모스 글자 간격

  function renderBuilt() {
    const textEl = $('camBuiltText'), beadsEl = $('camBuiltBeads');
    const has = built.length > 0;
    if (textEl) {
      textEl.innerHTML = has
        ? `<b>${escapeHtml(builtText())}</b> <span class="mono" style="color:var(--muted)">(${M.morseToGlyphs(builtMorse().replace(/ /g, '  '))})</span>`
        : '<span style="color:var(--muted);font-size:13px">아직 없음 — 첫 글자를 인식하고 ‘이 글자 추가’를 누르세요</span>';
    }
    if (beadsEl) {
      beadsEl.innerHTML = (has && global.Booth && global.Booth.morseToBeadsHTML)
        ? global.Booth.morseToBeadsHTML(builtMorse()) : '';
    }
    const u = $('camUndo'), c = $('camClear'), f = $('camFinish');
    if (u) u.disabled = !has; if (c) c.disabled = !has; if (f) f.disabled = !has;
  }
  function escapeHtml(s) { return (s || '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch])); }

  function finishBracelet() {
    const text = builtText();
    if (!text) return;
    built = [];                // 다음 손님을 위해 비움(확정 후 화면 전환)
    renderBuilt();
    global.Booth.confirmMessage(text, cmode, 'camera');
  }

  // ── 초기화 ─────────────────────────────────────────────────────────────
  function init() {
    video = $('camVideo'); overlay = $('camOverlay'); octx = overlay.getContext('2d');
    proc = document.createElement('canvas'); pctx = proc.getContext('2d', { willReadFrequently: true });

    $('camStart').onclick = start;
    $('camStop').onclick = stop;
    $('camReset').onclick = resetRecognition;
    $('camAdd').onclick = addCurrent;
    const undoB = $('camUndo'); if (undoB) undoB.onclick = undoLast;
    const clearB = $('camClear'); if (clearB) clearB.onclick = clearBuilt;
    const finishB = $('camFinish'); if (finishB) finishB.onclick = finishBracelet;
    renderBuilt();
    // 모드 탭
    document.querySelectorAll('#screen-camera [data-cmode]').forEach(t => {
      t.onclick = () => {
        cmode = t.dataset.cmode;
        document.querySelectorAll('#screen-camera [data-cmode]').forEach(x => x.classList.toggle('active', x === t));
        clearBuilt();          // 모드 바뀌면 만들던 메시지도 초기화(혼동 방지)
        resetRecognition();
      };
    });

    // 화면을 벗어나면 카메라를 끄고 배터리/프라이버시 보호
    global.registerScreen && global.registerScreen('camera', { onHide: () => { if (running) stop(); } });
  }

  // 테스트 훅(synthetic ImageData 로 인식 로직 검증용)
  global.Camera = { init, _analyzeImg: analyzeImg, _detectBeads: detectBeads };
})(window);

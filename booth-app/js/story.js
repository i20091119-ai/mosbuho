/* ============================================================================
 * story.js — 학년 선택 · 그림책 · 미션(해독+응답) · 마무리 개념정리
 * ----------------------------------------------------------------------------
 * 콘텐츠는 data/stories.js(window.STORIES)에서 읽고, 모스 신호/판정은
 * morse-engine 으로 자동 생성·검증. 전신키 입력은 morse-key.js 공용 위젯 사용.
 * 세계관: 학생=우주통신사. 해독=복호화, 응답(전신키)=암호화. 활동 중엔 이야기 언어,
 * 마무리에서 1회만 개념 정리(§5).
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.Morse;

  let grade = null;            // 'k' | 'e' | 'm'
  let data = null;            // STORIES[grade]
  let soundOn = true;

  // 스토리 진행 상태: phase 'intro'(도입·신호) / 'success'(응답성공·해피엔딩)
  let phase = 'intro', sceneIdx = 0;

  // 미션 상태
  let decodeOk = false, decodeTries = 0, replyTries = 0;
  let replyKey = null, replyText = '', replyComposer = null;
  let hintOn = false;

  function $(id) { return document.getElementById(id); }
  function maxTries() { return data.judge === 'high' ? 1 : data.judge === 'medium' ? 2 : 3; }
  function shuffleArr(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // 이미지 (없으면 파일명 표시 플레이스홀더로 폴백)
  function imgTag(file, cls) {
    const path = `assets/story/${data.dir}/${file}`;
    return `<img class="${cls}" src="${path}" alt=""
      onerror="this.outerHTML='<div class=&quot;img-ph ${cls}&quot;>그림 준비 중<br><small>${file}</small></div>'">`;
  }

  // 빛 신호 재생 (LED 점멸 + 부저) — buildPlaybackSequence 사용
  function playSignal(morse, ledEl, unit) {
    unit = unit || 150;
    const seq = M.buildPlaybackSequence(morse, unit);
    let t = 0;
    seq.forEach(e => {
      if (e.on) {
        setTimeout(() => { ledEl.classList.add('on'); if (soundOn && global.CWAudio) global.CWAudio.on(); }, t);
        setTimeout(() => { ledEl.classList.remove('on'); if (global.CWAudio) global.CWAudio.off(); }, t + e.ms);
      }
      t += e.ms;
    });
  }

  // ── 학년 선택 ────────────────────────────────────────────────────────────
  function buildGradeCards() {
    const colors = { k: 'var(--c-orange)', e: 'var(--c-blue)', m: 'var(--c-purple)' };
    const el = $('gradeCards');
    el.innerHTML = Object.keys(global.STORIES).map(g => {
      const s = global.STORIES[g];
      return `<button class="grade-card" data-grade="${g}" style="--gc:${colors[g]}">
        <div class="grade-badge" style="background:${colors[g]}">${g.toUpperCase()}</div>
        <h3>${s.label}</h3>
        <p>${s.sub}</p>
      </button>`;
    }).join('');
    el.querySelectorAll('.grade-card').forEach(c =>
      c.onclick = () => selectGrade(c.dataset.grade));
  }

  function selectGrade(g) {
    grade = g; data = global.STORIES[g];
    global.Booth.grade = g; global.Booth.mode = data.mode;
    phase = 'intro'; sceneIdx = 0;
    decodeOk = false; decodeTries = 0; replyTries = 0;
    renderStory();
    global.showScreen('story');
  }

  // ── 그림책 ────────────────────────────────────────────────────────────────
  function renderStory() {
    if (!data) { $('storyText').innerHTML = '먼저 <b>학년</b>을 선택해 주세요.'; $('storyImage').innerHTML = ''; $('storyDots').innerHTML = ''; return; }
    const scenes = data.story;
    const sc = scenes[sceneIdx];
    $('storyImage').innerHTML = imgTag(sc.img, 'story-img');
    $('storyText').innerHTML = sc.text.replace(/\n/g, '<br>');
    // 진행 점
    $('storyDots').innerHTML = scenes.map((_, i) =>
      `<span class="sdot ${i === sceneIdx ? 'on' : ''}"></span>`).join('');
    // 버튼 라벨
    const last = (phase === 'intro' && sceneIdx >= 1) ;
    $('storyNext').textContent = (phase === 'intro' && sceneIdx >= 1) ? '신호 해독하러 가기 →'
      : (phase === 'success' && sceneIdx >= 3) ? '미션 마무리 →' : '다음 →';
    $('storyPrev').style.visibility = (sceneIdx === (phase === 'intro' ? 0 : 2)) ? 'hidden' : 'visible';
  }
  function storyNext() {
    if (!data) return;
    if (phase === 'intro') {
      if (sceneIdx < 1) { sceneIdx++; renderStory(); }
      else { buildMission(); global.showScreen('mission'); }
    } else { // success
      if (sceneIdx < 3) { sceneIdx++; renderStory(); }
      else { buildFinish(); global.showScreen('finish'); }
    }
  }
  function storyPrev() {
    const min = phase === 'intro' ? 0 : 2;
    if (sceneIdx > min) { sceneIdx--; renderStory(); }
  }
  // 미션 성공 후 성공 장면(3,4) 보여주기
  function showSuccessStory() {
    phase = 'success'; sceneIdx = 2; renderStory(); global.showScreen('story');
  }

  // ── 미션 (해독 + 응답) ─────────────────────────────────────────────────────
  function buildMission() {
    decodeOk = false; decodeTries = 0; replyTries = 0; hintOn = false;
    replyText = ''; replyComposer = new M.HangulComposer();
    const decodeMorse = M.textToMorse(data.decode.answer, data.mode);
    const wrap = $('missionWrap');

    // 해독 카드
    let decodeInput = '';
    if (data.decode.options) {
      decodeInput = `<div class="opt-row">${shuffleArr(data.decode.options).map(o =>
        `<button class="opt-btn" data-opt="${o}">${o}</button>`).join('')}</div>`;
    } else {
      decodeInput = `<div class="decode-typein">
        <input id="decodeInput" placeholder="${data.mode === 'ko' ? '예: 산소' : '예: WATER'}"
               style="padding:12px 14px;border:2px solid var(--line);border-radius:var(--r-sm);font-size:20px;font-weight:800;flex:1;min-width:140px;text-align:center">
        <button class="btn ok" id="decodeCheck">확인</button></div>`;
    }
    const hintBtn = data.decode.hint ? `<button class="btn sm" id="hintBtn">글자 구분 힌트</button>` : '';

    wrap.innerHTML = `
      <div class="card mission-card">
        <div class="card-title">해독 미션 — 우주에서 온 신호 풀기 (복호화) ${hintBtn}</div>
        <div class="mission-prompt">${data.decode.prompt}</div>
        <div class="signal-stage">
          <div class="led mission-led" id="missionLed"></div>
          <button class="btn primary" id="signalPlay"><img class="ic" src="assets/icons/play.svg" alt="" onerror="this.style.display='none'">신호 다시 보기</button>
        </div>
        <div class="signal-shapes" id="signalShapes"></div>
        ${decodeInput}
        <div class="mission-feedback" id="decodeFb"></div>
      </div>
      <div class="card mission-card reply-card" id="replyCard" style="display:none">
        <div class="card-title">답신 미션 — 전신키로 답 보내기 (암호화)</div>
        <div class="mission-prompt" id="replyPrompt"></div>
        <div class="reply-target" id="replyTarget"></div>
        <div id="replyKeyHost"></div>
        <div class="reply-decoded">보낸 내용: <b id="replyDecodedText">—</b></div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn ok" id="replyCheck">확인</button>
          <button class="btn sm" id="replyClear">지우기</button>
        </div>
        <div class="mission-feedback" id="replyFb"></div>
      </div>`;

    renderSignalShapes(decodeMorse, false);
    const led = $('missionLed');
    setTimeout(() => playSignal(decodeMorse, led), 400);
    $('signalPlay').onclick = () => playSignal(decodeMorse, led);

    if (data.decode.hint) $('hintBtn').onclick = () => { hintOn = !hintOn; renderSignalShapes(decodeMorse, hintOn); };

    if (data.decode.options) {
      wrap.querySelectorAll('.opt-btn').forEach(b => b.onclick = () => checkDecode(b.dataset.opt));
    } else {
      $('decodeCheck').onclick = () => checkDecode($('decodeInput').value);
      $('decodeInput').addEventListener('keydown', e => { if (e.key === 'Enter') checkDecode($('decodeInput').value); });
    }
  }

  function renderSignalShapes(morse, withGaps) {
    // withGaps=true 면 글자 단위로 끊어 보여줌(힌트), 아니면 한 줄로
    const letters = morse.trim().split(/\s+/);
    if (withGaps) {
      $('signalShapes').innerHTML = letters.map(l =>
        `<span class="sig-letter shapes">${M.morseToShapesHTML(l)}</span>`).join('<span class="sig-gap"></span>');
    } else {
      $('signalShapes').innerHTML = `<span class="shapes">${letters.map(M.morseToShapesHTML).join('<span style="width:10px;display:inline-block"></span>')}</span>`;
    }
  }

  function norm(s) { return (s || '').trim().toUpperCase().replace(/\s+/g, ''); }

  function checkDecode(val) {
    const ok = norm(val) === norm(data.decode.answer);
    const fb = $('decodeFb');
    if (ok) {
      decodeOk = true;
      fb.className = 'mission-feedback ok'; fb.textContent = data.decode.npc;
      openReply();
    } else {
      decodeTries++;
      fb.className = 'mission-feedback bad';
      fb.textContent = '다시 한 번! 신호를 한 글자씩 천천히 풀어보자.';
      if (decodeTries >= maxTries()) {
        fb.innerHTML += ` <button class="btn sm purple" id="decodeHelp">정답 보고 계속</button>`;
        $('decodeHelp').onclick = () => { decodeOk = true; fb.className = 'mission-feedback ok'; fb.textContent = data.decode.npc; openReply(); };
      }
    }
  }

  function openReply() {
    const rc = $('replyCard'); rc.style.display = '';
    $('replyPrompt').textContent = data.reply.prompt;
    const rMorse = M.textToMorse(data.reply.answer, data.mode);
    $('replyTarget').innerHTML = `보낼 내용: <b>${data.reply.answer}</b> &nbsp; <span class="shapes sm">${rMorse.trim().split(/\s+/).map(M.morseToShapesHTML).join('<span style="width:8px;display:inline-block"></span>')}</span>`;
    replyText = ''; replyComposer = new M.HangulComposer(); replyTries = 0;
    $('replyDecodedText').textContent = '—';
    if (replyKey) replyKey.destroy();
    replyKey = global.createMorseKey($('replyKeyHost'), {
      mode: data.mode, unit: data.mode === 'num' ? 260 : 200, sound: soundOn,
      onChar: ch => {
        if (data.mode === 'ko') { replyComposer.feed(ch); replyText = replyComposer.getFullText(); }
        else replyText += ch;
        $('replyDecodedText').textContent = replyText || '—';
      },
      onWord: () => {
        if (data.mode === 'ko') { replyComposer.flush(); replyComposer.committed += ' '; replyText = replyComposer.getFullText(); }
        else replyText += ' ';
        $('replyDecodedText').textContent = replyText || '—';
      }
    });
    $('replyCheck').onclick = checkReply;
    $('replyClear').onclick = () => { replyText = ''; replyComposer = new M.HangulComposer(); replyKey.reset(); $('replyDecodedText').textContent = '—'; };
    if (rc.scrollIntoView) rc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function checkReply() {
    if (data.mode === 'ko') { replyComposer.flush(); replyText = replyComposer.getFullText(); }
    const ok = norm(replyText) === norm(data.reply.answer);
    const fb = $('replyFb');
    if (ok) {
      fb.className = 'mission-feedback ok'; fb.textContent = data.reply.npc + ' 🚀'.replace('🚀','');
      // 통계 기록(개인정보 없이)
      if (global.Stats) global.Stats.record({ text: data.reply.answer, mode: data.mode, source: 'mission', ts: Date.now() });
      setTimeout(showSuccessStory, 900);
    } else {
      replyTries++;
      fb.className = 'mission-feedback bad';
      fb.textContent = '신호가 조금 달라요. 실물 모스표를 보고 다시 보내볼까요?';
      if (replyTries >= maxTries()) {
        fb.innerHTML += ` <button class="btn sm purple" id="replyHelp">도움받아 성공</button>`;
        $('replyHelp').onclick = () => { fb.className = 'mission-feedback ok'; fb.textContent = data.reply.npc; setTimeout(showSuccessStory, 700); };
      }
    }
  }

  // ── 마무리 · 개념 정리 ─────────────────────────────────────────────────────
  function buildFinish() {
    const cipher = data.cipherEnabled
      ? `<div class="card" style="margin-top:14px"><div class="card-title">더 알아보기</div>
         <p>비밀 키(예: 글자를 한 칸씩 밀기)를 더하면 모스부호가 진짜 <b>암호(cipher)</b>가 돼요. 관심 있으면 해설사에게 물어보세요!</p></div>`
      : '';
    $('finishWrap').innerHTML = `
      <div class="card finish-card">
        <div class="finish-emblem">🛰️</div>
        <h2>미션 성공! 너는 멋진 우주통신사야</h2>
        <div class="concept-box">${data.concept}</div>
        <div class="concept-terms">
          <span><b>암호화</b> = 메시지 → 신호로 바꾸기 (전신키 답신)</span>
          <span><b>복호화</b> = 신호 → 메시지로 풀기 (해독·카메라)</span>
          <span><b>암호문</b> = 그 결과로 나온 신호</span>
        </div>
        <p class="finish-gift">🎁 엠버시 입체도형 퍼즐 키트를 받아 집에서 조립해 보세요!</p>
        <button class="btn primary" id="finishReset">새 친구를 위해 처음으로 ↺</button>
      </div>${cipher}`;
    $('finishReset').onclick = () => global.Booth.resetAll();
  }

  // 학년 미선택 시 안내(직접 네비 점프 대비)
  function needGradeHTML() {
    return '<div class="card"><p style="color:var(--muted)">먼저 <b>①학년</b>을 선택해 주세요.</p><button class="btn primary" onclick="showScreen(\'grade\')">학년 선택으로</button></div>';
  }

  // ── 외부 API ──
  function init() {
    buildGradeCards();
    $('storyNext').onclick = storyNext;
    $('storyPrev').onclick = storyPrev;
    renderStory();
  }
  function reset() {
    grade = null; data = null; phase = 'intro'; sceneIdx = 0;
    decodeOk = false; if (replyKey) { replyKey.destroy(); replyKey = null; }
    buildGradeCards(); renderStory();
    $('missionWrap').innerHTML = ''; $('finishWrap').innerHTML = '';
  }
  function setSound(s) { soundOn = s; if (replyKey) replyKey.setSound(s); }

  // 직접 네비 점프 대응 onShow 핸들러
  function onShowStory() { if (!data) { $('storyImage').innerHTML = ''; $('storyDots').innerHTML = ''; $('storyText').innerHTML = needGradeHTML(); } else renderStory(); }
  function onShowMission() { if (!data) { $('missionWrap').innerHTML = needGradeHTML(); } else if (!$('missionWrap').querySelector('.mission-card')) buildMission(); }
  function onShowFinish() { if (!data) { $('finishWrap').innerHTML = needGradeHTML(); } else buildFinish(); }

  global.Story = { init, reset, setSound, getGrade: () => grade, onShowStory, onShowMission, onShowFinish };
})(window);

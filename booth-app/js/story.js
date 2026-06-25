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
  let replyKey = null, replyText = '', replyComposer = null, replyAnswer = '';
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

  // 장면 위 움직이는 효과: 반짝이는 별 + 신호 파동(들어옴/나감)
  function buildFx(idx) {
    let stars = '';
    for (let i = 0; i < 16; i++) {
      const x = (Math.random() * 100).toFixed(1), y = (Math.random() * 100).toFixed(1);
      const d = (Math.random() * 3).toFixed(2), sz = (2 + Math.random() * 3).toFixed(1);
      stars += `<span class="star" style="left:${x}%;top:${y}%;width:${sz}px;height:${sz}px;animation-delay:${d}s"></span>`;
    }
    let signal = '';
    if (idx === 1) signal = '<span class="signal-wave in"></span><span class="signal-wave in" style="animation-delay:1s"></span>';      // 신호가 들어옴
    else if (idx === 2) signal = '<span class="signal-wave out"></span><span class="signal-wave out" style="animation-delay:1s"></span>'; // 답신이 나감
    return `<div class="story-fx">${stars}${signal}</div>`;
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
    const img = $('storyImage');
    img.innerHTML = imgTag(sc.img, 'story-img') + buildFx(sceneIdx);
    // 책장 넘김 애니메이션 재생(클래스 재적용으로 매번 트리거)
    img.classList.remove('turn'); void img.offsetWidth; img.classList.add('turn');
    const txt = $('storyText');
    txt.innerHTML = sc.text.replace(/\n/g, '<br>');
    txt.classList.remove('turn'); void txt.offsetWidth; txt.classList.add('turn');
    // 진행 점
    $('storyDots').innerHTML = scenes.map((_, i) =>
      `<span class="sdot ${i === sceneIdx ? 'on' : ''}"></span>`).join('');
    // 버튼 라벨
    const last = (phase === 'intro' && sceneIdx >= 1) ;
    $('storyNext').textContent = (phase === 'intro' && sceneIdx >= 1) ? '신호 해독하러 가기 →'
      : (phase === 'success' && sceneIdx >= 3) ? '전신키로 계속하기 →' : '다음 →';
    $('storyPrev').style.visibility = (sceneIdx === (phase === 'intro' ? 0 : 2)) ? 'hidden' : 'visible';
  }
  function storyNext() {
    if (!data) return;
    if (phase === 'intro') {
      if (sceneIdx < 1) { sceneIdx++; renderStory(); }
      else { buildMission(); global.showScreen('mission'); }
    } else { // success: 해피엔딩 후엔 ④전신키로 이어서 활동 계속 (마무리는 ⑦ 뒤에)
      if (sceneIdx < 3) { sceneIdx++; renderStory(); }
      else { global.showScreen('telegraph'); }
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
    // 응답 정답 = 앞글자(base) + 수학 문제의 답(math.a). 정답 모스는 보여주지 않음.
    const base = data.reply.base || '';
    const math = data.reply.math;
    replyAnswer = math ? base + math.a : (data.reply.answer || '');
    if (math) {
      $('replyTarget').innerHTML =
        `보낼 신호: <b>${base || '(숫자)'}</b> + <b>수학 문제의 답</b>
         <div class="math-q">${math.q}</div>
         <span class="mut">답을 ${base ? '“' + base + '” 뒤에 붙여 ' : ''}전신키로 보내요! (모스부호는 실물 표에서 찾기)</span>`;
    } else {
      $('replyTarget').innerHTML = `보낼 말: <b>${replyAnswer}</b> <span class="mut">— 실물 모스부호표에서 찾아 전신키로 보내요!</span>`;
    }
    replyText = ''; replyComposer = new M.HangulComposer(); replyTries = 0;
    $('replyDecodedText').textContent = '—';
    if (replyKey) replyKey.destroy();
    replyKey = global.createMorseKey($('replyKeyHost'), {
      mode: data.mode, unit: 320, sound: soundOn,   // 넉넉한 단위(아이 친화)
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
    const ok = norm(replyText) === norm(replyAnswer);
    const fb = $('replyFb');
    if (ok) {
      fb.className = 'mission-feedback ok'; fb.textContent = data.reply.npc;
      // 통계 기록(개인정보 없이)
      if (global.Stats) global.Stats.record({ text: replyAnswer, mode: data.mode, source: 'mission', ts: Date.now() });
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
        <div class="finish-emblem"><img src="assets/deco/rocket.svg" alt="" onerror="this.remove()"></div>
        <h2>미션 성공! 너는 멋진 우주통신사야</h2>
        <div class="concept-box">${data.concept}</div>
        <div class="concept-terms">
          <span><b>암호화</b> = 메시지 → 신호로 바꾸기 (전신키 답신)</span>
          <span><b>복호화</b> = 신호 → 메시지로 풀기 (해독·카메라)</span>
          <span><b>암호문</b> = 그 결과로 나온 신호</span>
        </div>
        <p class="finish-gift"><img class="finish-spark" src="assets/deco/sparkle.svg" alt="" onerror="this.remove()">엠버시 입체도형 퍼즐 키트를 받아 집에서 조립해 보세요!</p>
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

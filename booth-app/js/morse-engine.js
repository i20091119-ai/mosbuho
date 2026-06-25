/* ============================================================================
 * morse-engine.js — 경남수학문화관 부스앱 공통 모스부호 엔진
 * ----------------------------------------------------------------------------
 * 기존 바이브코딩 5개 HTML(특히 morse_code_trainer_v3 / morse_trainer_v3_mobile_hangul)
 * 에 중복 구현돼 있던 변환 로직을 추출·통합한 단일 모듈.
 *
 * 제공 기능
 *   1) 모스 ↔ 문자 변환 테이블 (영문/숫자/기호/한글 자모)
 *   2) 한글 자모 → 음절 조합 엔진 (HangulComposer, 유니코드 0xAC00 조합)
 *   3) 한글 음절 → 자모 분해 (compound 자모 분해 포함) — 역방향 인코딩용
 *   4) 누름시간 → 점/대시 판정 + 타이밍 모델
 *   5) 표준 모스 타이밍(1:3:1, 글자 3, 단어 7)으로 재생 시퀀스 생성
 *   6) 점/대시 도형 렌더링 헬퍼
 *
 * 순수 JS · 외부 의존성 없음 · 오프라인(file://) 동작 보장.
 * 전역 네임스페이스 window.Morse 로 노출 (ES module 미사용 → 부스 오프라인 호환).
 * ==========================================================================*/
(function (global) {
  'use strict';

  // ── 1. 변환 테이블 (모스 → 문자) ───────────────────────────────────────────
  // 국제 모스부호(ITU) 영문 26자
  const EN = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F',
    '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
    '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
    '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
    '-.--': 'Y', '--..': 'Z'
  };
  // 숫자 0–9
  const NUM = {
    '.----': '1', '..---': '2', '...--': '3', '....-': '4', '.....': '5',
    '-....': '6', '--...': '7', '---..': '8', '----.': '9', '-----': '0'
  };
  // 기호
  const SYM = {
    '.-.-.-': '.', '--..--': ',', '..--..': '?', '-.-.--': '!', '-..-.': '/',
    '-.--.': '(', '-.--.-': ')', '---...': ':', '-.-.-.': ';', '-...-': '=',
    '.-.-.': '+', '-....-': '-', '..--.-': '_', '.-..-.': '"', '.----.': '\''
  };
  // 한글 자모 (표준 한글 모스부호 · 자음 14 + 모음 10)
  const KO = {
    '.-..': 'ㄱ', '..-.': 'ㄴ', '-...': 'ㄷ', '...-': 'ㄹ', '--': 'ㅁ', '.--': 'ㅂ',
    '--.': 'ㅅ', '-.-': 'ㅇ', '.--.': 'ㅈ', '-.-.': 'ㅊ', '-..-': 'ㅋ', '--..': 'ㅌ',
    '---': 'ㅍ', '.---': 'ㅎ',
    '.': 'ㅏ', '..': 'ㅑ', '-': 'ㅓ', '...': 'ㅕ', '.-': 'ㅗ', '-.': 'ㅛ',
    '....': 'ㅜ', '.-.': 'ㅠ', '-..': 'ㅡ', '..-': 'ㅣ'
  };

  // 역방향 테이블 (문자 → 모스)
  function buildRev(tbl) {
    const r = {};
    for (const [k, v] of Object.entries(tbl)) r[v] = k;
    return r;
  }
  const REV_EN = buildRev(EN), REV_KO = buildRev(KO),
        REV_NUM = buildRev(NUM), REV_SYM = buildRev(SYM);

  // 모드별 접근자
  const MODES = ['en', 'ko', 'num', 'sym'];
  function getTable(mode) {
    return mode === 'en' ? EN : mode === 'ko' ? KO : mode === 'num' ? NUM : SYM;
  }
  function getRev(mode) {
    return mode === 'en' ? REV_EN : mode === 'ko' ? REV_KO : mode === 'num' ? REV_NUM : REV_SYM;
  }
  // 부스 카메라 단계는 영/한 혼합이 없으므로 모드별 디코딩을 쓴다.
  // 모드 불명 시 영문→숫자→기호 순으로 시도하는 통합 디코더.
  function decodeAny(token) {
    return EN[token] || NUM[token] || SYM[token] || KO[token] || '?';
  }
  function decode(token, mode) {
    if (!token) return '';
    return getTable(mode)[token] || '?';
  }

  // ── 2. 한글 조합 엔진 (FSM, 유니코드 음절 조합) ─────────────────────────────
  const CONSONANTS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const VOWELS = ['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ', 'ㅣ'];
  const CHO_S = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const JUNG_S = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const JONG_S = ['\0', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ',
                  'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const CI = {}; CHO_S.split('').forEach((c, i) => CI[c] = i);
  const JI = {}; JUNG_S.split('').forEach((c, i) => JI[c] = i);
  const KI = {}; JONG_S.forEach((c, i) => { if (c !== '\0') KI[c] = i; });

  function composeSyllable(cho, jung, jong) {
    const ci = CI[cho], ji = JI[jung];
    if (ci === undefined || ji === undefined) return (cho || '') + (jung || '') + (jong || '');
    const ki = jong ? KI[jong] : 0;
    if (ki === undefined) return String.fromCharCode(0xAC00 + (ci * 21 + ji) * 28) + (jong || '');
    return String.fromCharCode(0xAC00 + (ci * 21 + ji) * 28 + ki);
  }

  // 자모 입력을 음절로 누적 조합하는 상태기계.
  // (morse_trainer_v3_mobile_hangul.html 의 HangulComposer 를 그대로 보존·이식)
  class HangulComposer {
    constructor() { this.reset(); }
    reset() { this.state = 'EMPTY'; this.cho = null; this.jung = null; this.jong = null; this.committed = ''; }
    feed(jamo) {
      const isC = CONSONANTS.includes(jamo), isV = VOWELS.includes(jamo);
      let nc = '';
      switch (this.state) {
        case 'EMPTY':
          if (isC) { this.cho = jamo; this.state = 'CHO'; }
          else if (isV) { nc = jamo; }
          break;
        case 'CHO':
          if (isV) { this.jung = jamo; this.state = 'JUNG'; }
          else if (isC) { nc = this.cho; this.cho = jamo; }
          break;
        case 'JUNG':
          if (isC) { this.jong = jamo; this.state = 'JONG'; }
          else if (isV) { nc = composeSyllable(this.cho, this.jung, null); this.cho = null; this.jung = null; nc += jamo; this.state = 'EMPTY'; }
          break;
        case 'JONG':
          if (isV) { nc = composeSyllable(this.cho, this.jung, null); this.cho = this.jong; this.jung = jamo; this.jong = null; this.state = 'JUNG'; }
          else if (isC) { nc = composeSyllable(this.cho, this.jung, this.jong); this.cho = jamo; this.jung = null; this.jong = null; this.state = 'CHO'; }
          break;
      }
      this.committed += nc;
      return nc;
    }
    flush() {
      let f = '';
      if (this.state === 'CHO') f = this.cho;
      else if (this.state === 'JUNG') f = composeSyllable(this.cho, this.jung, null);
      else if (this.state === 'JONG') f = composeSyllable(this.cho, this.jung, this.jong);
      this.committed += f; this.cho = null; this.jung = null; this.jong = null; this.state = 'EMPTY';
      return f;
    }
    getComposing() {
      if (this.state === 'CHO') return this.cho;
      if (this.state === 'JUNG') return composeSyllable(this.cho, this.jung, null);
      if (this.state === 'JONG') return composeSyllable(this.cho, this.jung, this.jong);
      return '';
    }
    getFullText() { return this.committed + this.getComposing(); }
  }

  // ── 3. 한글 음절 → 자모 분해 (역방향 인코딩용) ─────────────────────────────
  // 모스 테이블에 없는 겹자모/복합모음을 기본 자모로 분해하는 표
  const COMPOUND = {
    'ㄲ': 'ㄱㄱ', 'ㄸ': 'ㄷㄷ', 'ㅃ': 'ㅂㅂ', 'ㅆ': 'ㅅㅅ', 'ㅉ': 'ㅈㅈ',
    'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ',
    'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ',
    'ㅐ': 'ㅏㅣ', 'ㅒ': 'ㅑㅣ', 'ㅔ': 'ㅓㅣ', 'ㅖ': 'ㅕㅣ', 'ㅘ': 'ㅗㅏ',
    'ㅙ': 'ㅗㅏㅣ', 'ㅚ': 'ㅗㅣ', 'ㅝ': 'ㅜㅓ', 'ㅞ': 'ㅜㅓㅣ', 'ㅟ': 'ㅜㅣ'
  };
  function expandJamo(j) { return COMPOUND[j] ? COMPOUND[j].split('') : [j]; }

  // 한글 문자열 → 기본 자모 배열 (음절 분해 + 복합 자모 분해)
  function hangulToJamos(text) {
    const out = [];
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (code >= 0xAC00 && code <= 0xD7A3) {
        const s = code - 0xAC00;
        const cho = CHO_S[Math.floor(s / 588)];
        const jung = JUNG_S[Math.floor((s % 588) / 28)];
        const jongIdx = s % 28;
        expandJamo(cho).forEach(x => out.push(x));
        expandJamo(jung).forEach(x => out.push(x));
        if (jongIdx > 0) expandJamo(JONG_S[jongIdx]).forEach(x => out.push(x));
      } else if (ch === ' ') {
        out.push(' ');
      } else {
        out.push(ch); // 이미 자모이거나 기타 문자
      }
    }
    return out;
  }

  // ── 4. 누름시간 판정 + 타이밍 모델 ────────────────────────────────────────
  // 기준 단위(ms) → 점/대시 임계값(dd), 글자간격(cg), 단어간격(wg)
  // 학생(특히 유아)이 요소 사이에서 멈칫해도 글자가 성급히 확정되지 않도록 cg 를 넉넉히.
  function timingModel(unitMs) {
    const u = +unitMs || 200;
    return { dd: u, cg: Math.round(u * 3.5), wg: Math.round(u * 8) };
  }
  // 누름 지속시간(ms) → '.'(점) 또는 '-'(대시)
  function durationToSymbol(durMs, ddMs) {
    return durMs <= ddMs ? '.' : '-';
  }

  // ── 5. 재생 시퀀스 (표준 모스 타이밍 1:3:1 / 글자 3 / 단어 7) ───────────────
  // 입력: 정규화 모스 문자열 — 요소는 '.'/'-', 글자 구분은 ' '(공백), 단어 구분은 '/'
  //   예) "... --- ..."(SOS) , ".... .. / -- -.-- "(HI MY ...)
  // 출력: [{on:true, ms}, {on:false, ms}, ...] LED/부저 점멸용 이벤트 배열
  function buildPlaybackSequence(morseString, unitMs) {
    const u = +unitMs || 120;            // 1 unit(=dit) 길이(ms)
    const DOT = u, DASH = u * 3;          // 점 1, 대시 3
    const GAP_EL = u, GAP_CHAR = u * 3, GAP_WORD = u * 7; // 요소간 1, 글자간 3, 단어간 7
    const seq = [];
    const words = morseString.trim().split('/');
    words.forEach((word, wi) => {
      const letters = word.trim().split(/\s+/).filter(Boolean);
      letters.forEach((letter, li) => {
        const els = letter.split('');
        els.forEach((el, ei) => {
          seq.push({ on: true, ms: el === '.' ? DOT : DASH });
          if (ei < els.length - 1) seq.push({ on: false, ms: GAP_EL });
        });
        if (li < letters.length - 1) seq.push({ on: false, ms: GAP_CHAR });
      });
      if (wi < words.length - 1) seq.push({ on: false, ms: GAP_WORD });
    });
    return seq;
  }

  // 문자열(영/숫/기호/한글) → 정규화 모스 문자열
  function textToMorse(text, mode) {
    if (mode === 'ko') {
      const jamos = hangulToJamos(text);
      return jamos.map(j => j === ' ' ? '/' : (REV_KO[j] || '')).filter(Boolean).join(' ')
        .replace(/\s*\/\s*/g, ' / ');
    }
    const rev = mode === 'num' ? REV_NUM : mode === 'sym' ? REV_SYM : REV_EN;
    return text.toUpperCase().split('').map(c => {
      if (c === ' ') return '/';
      return rev[c] || REV_EN[c] || REV_NUM[c] || REV_SYM[c] || '';
    }).filter(Boolean).join(' ').replace(/\s*\/\s*/g, ' / ');
  }

  // ── 6. 렌더링 헬퍼 (점/대시 도형) ─────────────────────────────────────────
  // CSS 클래스 .m-dot / .m-dash 로 렌더 (style.css 에서 점=빨강, 대시=파랑)
  function morseToShapesHTML(morse) {
    if (!morse) return '';
    return morse.split('').map(s =>
      s === '.' ? '<span class="m-dot"></span>' : '<span class="m-dash"></span>'
    ).join('');
  }
  // 가독용 기호 변환 (· 과 —)
  function morseToGlyphs(morse) {
    return (morse || '').split('').map(s => s === '.' ? '·' : '—').join(' ');
  }

  // ── 공개 API ──────────────────────────────────────────────────────────────
  global.Morse = {
    // 테이블
    EN, NUM, SYM, KO, REV_EN, REV_NUM, REV_SYM, REV_KO, MODES,
    getTable, getRev, decode, decodeAny,
    // 한글
    HangulComposer, composeSyllable, hangulToJamos, CONSONANTS, VOWELS,
    // 타이밍
    timingModel, durationToSymbol,
    // 재생/인코딩
    buildPlaybackSequence, textToMorse,
    // 렌더
    morseToShapesHTML, morseToGlyphs
  };
})(typeof window !== 'undefined' ? window : this);

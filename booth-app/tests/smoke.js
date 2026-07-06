/* ============================================================================
 * tests/smoke.js — 헤드리스 DOM 전체 흐름 스모크 테스트
 * ----------------------------------------------------------------------------
 * 실제 브라우저 없이 jsdom 으로 앱을 로드하고, 학년→이야기→미션→팔찌→신호확인→
 * 마무리→통계→전신키까지 클릭으로 돌려 흐름이 깨지지 않았는지 검증한다.
 *
 * 실행:
 *   cd booth-app
 *   npm i -D jsdom        # 최초 1회 (인터넷 필요)
 *   node tests/smoke.js
 *
 * 종료코드 0 = 전부 통과, 1 = 실패(아래 목록에 ✗ 표시).
 * 주의: jsdom 은 레이아웃/캔버스/카메라/오디오를 구현하지 않으므로 "기능·흐름"만
 *       검증한다. 실제 화면·웹캠·소리는 브라우저(또는 UNO Q)에서 확인할 것.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
catch (e) { console.error('jsdom 이 필요합니다.  먼저:  npm i -D jsdom'); process.exit(2); }

const ROOT = path.join(__dirname, '..');               // booth-app/
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const vc = new VirtualConsole();
vc.on('jsdomError', () => {});                          // 캔버스 미구현 등 noise 무시
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc });
const { window } = dom;
const document = window.document;
window.requestAnimationFrame = window.requestAnimationFrame || (cb => setTimeout(cb, 16));

const order = ['js/morse-engine.js', 'data/stories.js', 'js/audio.js', 'js/morse-key.js',
  'js/stats.js', 'js/story.js', 'js/camera.js', 'js/arduino.js', 'js/app.js'];
const errors = [];
window.addEventListener('error', e => errors.push('window error: ' + e.message));
for (const f of order) {
  try { window.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); }
  catch (e) { errors.push('LOAD FAIL ' + f + ': ' + e.message); }
}
// 실브라우저에선 end-of-body 스크립트가 파싱 중 실행되어 DOMContentLoaded 로 boot 됨.
// jsdom 타이밍 보정용 명시 트리거.
window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

const log = [];
function $(id) { return document.getElementById(id); }
function click(el) { if (!el) throw new Error('click: element null'); el.dispatchEvent(new window.Event('click', { bubbles: true })); }
function check(name, cond) { log.push((cond ? '✓' : '✗') + '  ' + name); if (!cond) errors.push('CHECK FAIL: ' + name); }

try {
  check('스크립트 로드 무에러', errors.length === 0);
  check('초기 화면 = 학년(grade) active', $('screen-grade').classList.contains('active'));
  check('학년 카드 3개 생성', document.querySelectorAll('.grade-card').length === 3);

  // 유아(k): 그림책 → 객관식 해독 → 응답(도움버튼)
  click([...document.querySelectorAll('.grade-card')].find(c => c.dataset.grade === 'k'));
  check('k 선택 후 이야기 화면', $('screen-story').classList.contains('active'));
  check('스토리 삽화 경로 k_01_lost', /k_01_lost\.png/.test($('storyImage').innerHTML));
  click($('storyNext'));
  check('스토리 2장면 신호', /k_02_signal\.png/.test($('storyImage').innerHTML));
  click($('storyNext'));
  check('미션 화면', $('screen-mission').classList.contains('active'));
  check('해독 객관식 3개', document.querySelectorAll('.opt-btn').length === 3);
  check('신호 도형 렌더', /m-dot|m-dash/.test($('signalShapes').innerHTML));
  click([...document.querySelectorAll('.opt-btn')].find(b => b.dataset.opt === '1'));
  check('해독 정답→응답카드', $('replyCard').style.display !== 'none');
  check('응답 키 위젯 생성', $('replyKeyHost').querySelector('.mk-key') !== null);
  check('한 글자 지우기 버튼 있음', $('replyDel') !== null);
  check('응답에 수학 문제 표시', $('replyTarget').innerHTML.includes('math-q'));
  click($('replyCheck'));
  check('관용도(k) 도움 버튼', $('replyHelp') !== null);
  if ($('replyHelp')) click($('replyHelp'));

  // 초등고(e): 직접 입력(대소문자 무시)
  click($('navReset'));
  check('리셋 후 학년 화면', $('screen-grade').classList.contains('active'));
  click([...document.querySelectorAll('.grade-card')].find(c => c.dataset.grade === 'e'));
  click($('storyNext')); click($('storyNext'));
  check('e 해독 객관식 보기', document.querySelectorAll('.opt-btn').length >= 2);
  click([...document.querySelectorAll('.opt-btn')].find(b => b.dataset.opt === 'WATER'));
  check('e 객관식 정답 선택', $('replyCard').style.display !== 'none');

  // 중·고(m): 한글 — 객관식 (키보드 타이핑 없음)
  click($('navReset'));
  click([...document.querySelectorAll('.grade-card')].find(c => c.dataset.grade === 'm'));
  click($('storyNext')); click($('storyNext'));
  check('m 해독 객관식 보기', document.querySelectorAll('.opt-btn').length >= 2);
  click([...document.querySelectorAll('.opt-btn')].find(b => b.dataset.opt === 'B7'));
  check('m 영문+숫자 객관식 정답', $('replyCard').style.display !== 'none');

  // 확정 → 팔찌 → 아두이노 → 마무리, 통계 기록
  window.Booth.confirmMessage('SOS', 'en', 'camera');
  check('확정 후 팔찌 화면', $('screen-bracelet').classList.contains('active'));
  check('팔찌 비즈 배열 렌더', $('braceletView').innerHTML.includes('bead-big'));
  check('아두이노 메시지 전달(모스 표시)', $('ardMorse').textContent.length > 0);
  click($('braceletNext'));
  check('팔찌→신호확인 이동', $('screen-arduino').classList.contains('active'));
  click($('ardNext'));
  check('신호확인→마무리 이동', $('screen-finish').classList.contains('active'));
  check('통계 기록됨(>=1)', JSON.parse(window.localStorage.getItem('gnmc_booth_msgs_v1') || '[]').length >= 1);

  // ④전신키(자유연습) 화면 제거 확인
  check('전신키 화면 제거됨', $('screen-telegraph') === null);
  check('전신키 나비 제거됨', document.querySelector('[data-screen="telegraph"]') === null);
} catch (e) { errors.push('RUNTIME: ' + e.message + '\n' + e.stack); }

console.log(log.join('\n'));
console.log('\n' + (errors.length ? '실패 ' + errors.length + '건' : '전부 통과 (' + log.length + '개 체크)'));
if (errors.length) console.log(errors.join('\n---\n'));
process.exit(errors.length ? 1 : 0);

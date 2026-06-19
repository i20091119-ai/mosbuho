/* ============================================================================
 * stats.js — ②③에서 입력/제작된 메시지 수집 · 통계 시각화
 * ----------------------------------------------------------------------------
 * 개인정보 없이 메시지 텍스트만 수집해 가장 많이 쓰인 글자, 길이 분포,
 * 최근 메시지를 보여준다.
 * 저장 계층은 어댑터 패턴으로 분리 — 기본 localStorage, 추후 Google Sheets 연동 대비.
 * 차트는 Chart.js(CDN). 오프라인으로 미로드 시 순수 HTML 막대그래프로 폴백.
 * ==========================================================================*/
(function (global) {
  'use strict';

  // ── 저장 어댑터 (교체 가능) ─────────────────────────────────────────────
  // 상설 운영 시 GoogleSheetsAdapter 등으로 교체하면 통계 계층은 그대로 동작.
  const LocalStorageAdapter = {
    KEY: 'gnmc_booth_msgs_v1',
    loadAll() {
      try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch (e) { return []; }
    },
    save(rec) {
      const all = this.loadAll();
      all.push(rec);
      if (all.length > 2000) all.shift(); // 상한
      try { localStorage.setItem(this.KEY, JSON.stringify(all)); } catch (e) {}
    },
    clear() { try { localStorage.removeItem(this.KEY); } catch (e) {} }
  };

  /* 예시: 추후 구글시트 연동 시 동일 인터페이스로 구현 (loadAll/save/clear)
  const GoogleSheetsAdapter = {
    ENDPOINT: 'https://script.google.com/.../exec',
    async save(rec) { await fetch(this.ENDPOINT, { method:'POST', body: JSON.stringify(rec) }); },
    async loadAll() { const r = await fetch(this.ENDPOINT); return r.json(); },
    clear() {}
  };
  */

  let store = LocalStorageAdapter; // 활성 어댑터

  // ── 기록 ───────────────────────────────────────────────────────────────
  function record(rec) {
    store.save(rec);
    if (document.getElementById('screen-stats').classList.contains('active')) refresh();
  }

  // ── 집계 ───────────────────────────────────────────────────────────────
  function aggregate() {
    const all = store.loadAll();
    const charFreq = {}, lenBuckets = {};
    let totalChars = 0;
    all.forEach(r => {
      const t = (r.text || '').replace(/\s/g, '');
      totalChars += t.length;
      for (const ch of t) charFreq[ch] = (charFreq[ch] || 0) + 1;
      const len = (r.text || '').replace(/\s/g, '').length;
      const b = len <= 1 ? '1' : len <= 3 ? '2-3' : len <= 5 ? '4-5' : len <= 8 ? '6-8' : '9+';
      lenBuckets[b] = (lenBuckets[b] || 0) + 1;
    });
    return { all, charFreq, lenBuckets, totalChars };
  }

  // ── 렌더 ───────────────────────────────────────────────────────────────
  let charChart = null, lenChart = null;
  const hasChart = () => typeof global.Chart !== 'undefined';

  function refresh() {
    const { all, charFreq, lenBuckets, totalChars } = aggregate();

    // 요약 카드
    document.getElementById('statCards').innerHTML = [
      { v: all.length, l: '제작된 메시지' },
      { v: totalChars, l: '전체 글자 수' },
      { v: all.length ? (totalChars / all.length).toFixed(1) : '0', l: '평균 길이' },
      { v: Object.keys(charFreq).length, l: '사용된 글자 종류' }
    ].map(s => `<div class="stat-box"><div class="v">${s.v}</div><div class="l">${s.l}</div></div>`).join('');

    // 글자 빈도 (상위 12)
    const topChars = Object.entries(charFreq).sort((a, b) => b[1] - a[1]).slice(0, 12);
    drawBar('char', topChars.map(c => c[0]), topChars.map(c => c[1]), '글자 사용 횟수');

    // 길이 분포
    const order = ['1', '2-3', '4-5', '6-8', '9+'];
    const lens = order.filter(k => lenBuckets[k]);
    drawBar('len', lens, lens.map(k => lenBuckets[k]), '메시지 수');

    // 최근 메시지
    const recent = all.slice(-12).reverse();
    document.getElementById('recentList').innerHTML = recent.length
      ? recent.map(r => {
          const tm = new Date(r.ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
          const icon = r.source === 'camera' ? 'camera' : 'telegraph';
          const label = r.source === 'camera' ? '카메라' : r.source === 'mission' ? '미션' : '전신키';
          // 아이콘 이미지 없으면 텍스트 라벨로 폴백(이모지/도형 미사용)
          const src = `<img class="ic-src" src="assets/icons/${icon}.svg" alt="${label}" onerror="this.replaceWith(document.createTextNode('[${label}] '))">`;
          return `<div>${src}<b>${escapeHtml(r.text)}</b> <span style="color:var(--muted)">· ${tm}</span></div>`;
        }).join('')
      : '<span style="color:var(--muted)">아직 기록이 없어요. ②전신키·③카메라에서 메시지를 보내면 모여요.</span>';
  }

  function escapeHtml(s) { return (s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

  // Chart.js 있으면 캔버스, 없으면 HTML 막대 폴백
  function drawBar(which, labels, data, label) {
    const canvas = document.getElementById(which + 'Chart');
    const bars = document.getElementById(which + 'Bars');
    if (hasChart()) {
      bars.innerHTML = ''; canvas.style.display = 'block';
      const cfg = {
        type: 'bar',
        data: { labels, datasets: [{ label, data,
          backgroundColor: labels.map((_, i) => ['#C00018', '#F07818', '#78A818', '#1878C0', '#784890'][i % 5]),
          borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
      };
      if (which === 'char') { if (charChart) charChart.destroy(); charChart = new global.Chart(canvas, cfg); }
      else { if (lenChart) lenChart.destroy(); lenChart = new global.Chart(canvas, cfg); }
    } else {
      // 폴백: HTML 막대
      canvas.style.display = 'none';
      const max = Math.max(1, ...data);
      bars.innerHTML = labels.length
        ? labels.map((k, i) => `<div class="bar-row"><span class="k">${escapeHtml(k)}</span>
            <span class="track"><span class="fill" style="width:${data[i] / max * 100}%"></span></span>
            <span class="n">${data[i]}</span></div>`).join('')
        : '<span style="color:var(--muted)">데이터가 모이면 표시됩니다.</span>';
    }
  }

  function init() {
    document.getElementById('statClear').onclick = () => {
      if (confirm('수집된 메시지 기록을 모두 지울까요?')) { store.clear(); refresh(); }
    };
    // 어댑터 교체 지점: 상설 운영 시 store = GoogleSheetsAdapter;
    global.registerScreen && global.registerScreen('stats', { onShow: refresh });
  }

  global.Stats = { init, record, refresh };
})(window);

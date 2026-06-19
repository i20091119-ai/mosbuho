# 직접 구해서 넣어야 할 것 — 전체 체크리스트

경남수학문화관 부스앱은 **UNO Q 로컬·오프라인** 구동이라 모든 에셋을 파일로 받아 폴더에 넣습니다(외부 링크 X).
**파일명을 아래와 똑같이** 저장하면 코드 수정 없이 자동으로 잡힙니다. 없으면 깔끔히 폴백하니 일부만 넣어도 안전합니다.

폴더 위치: `booth-app/assets/` 아래 — `fonts/`, `img/`, `icons/` (이미 생성돼 있음).

---

## 한눈에 보기

| # | 항목 | 개수 | 폴더 | 필수도 |
|---|---|---|---|---|
| 1 | 로고 | 1 | `assets/` | 권장(없으면 재현 SVG 사용) |
| 2 | 폰트 | 4 | `assets/fonts/` | 권장(없으면 시스템 폰트) |
| 3 | 단계 일러스트 | 5 | `assets/img/` | 선택(없으면 표시 안 함) |
| 4 | 아이콘 | 12 | `assets/icons/` | **필수**(없으면 텍스트만) |
| 5 | 배경 사진 | 1 | `assets/img/` | 선택(미배선) |

> 파비콘(`assets/favicon.svg`)은 **이미 제가 만들어 넣었음** → 받을 필요 없음.

---

## 1. 로고  →  `assets/`

- [ ] **`gnmc_logo.png`** — 경남수학문화관 공식 로고 (배경 투명 PNG 권장)
  - 위치: `assets/gnmc_logo.png`
  - 동작: 넣으면 헤더가 **자동으로 이 PNG 사용**. 없으면 제가 만든 `gnmc_logo.svg` 재현본이 표시됨.
  - 출처: 기관 보유 원본 파일(가장 정확). 라이선스: 기관 자산.

---

## 2. 폰트  →  `assets/fonts/`  (전부 SIL OFL 1.1 · 저작권 표기 불필요)

- [ ] **`PretendardVariable.woff2`** — 한글 본문 (가변폰트 1개로 굵기 400~800 전부 커버)
  - 받는 곳: github.com/orioncactus/pretendard → `packages/pretendard/dist/web/variable/`
- [ ] **`IBMPlexMono-Regular.woff2`** — 숫자·모스 표기 (400)
- [ ] **`IBMPlexMono-SemiBold.woff2`** — (600)
- [ ] **`IBMPlexMono-Bold.woff2`** — (700)
  - 받는 곳: fonts.google.com/specimen/IBM+Plex+Mono 또는 github.com/IBM/plex
  - ※ woff2 가 없고 ttf만 있으면 그대로 넣고 말씀 주세요 — `@font-face` 포맷을 맞춰드립니다.

> **활성화(중요)**: 위 파일을 넣은 뒤 `css/style.css` 상단의 `@font-face { ... }` **주석 블록을 해제**해야 적용됩니다.
> (한글을 Pretendard 대신 **Noto Sans KR**(OFL)로 쓰고 싶으면 그 woff2를 넣고 알려주세요 — family명 바꿔드림.)

---

## 3. 단계 일러스트  →  `assets/img/`  (추천: unDraw, **CC0 · 표기 불필요**)

undraw.co 에서 색을 `#F07818`(브랜드 주황)로 지정 후 **SVG 다운로드** → 아래 이름으로 저장.

- [ ] **`welcome.svg`** — 홈 상단 큰 그림 (검색어: `connection`, `code typing`)
- [ ] **`step-telegraph.svg`** — 홈 ② 카드 (검색어: `click here`, `buttons`)
- [ ] **`step-camera.svg`** — 홈 ③ 카드 (검색어: `camera`, `scan`)
- [ ] **`step-arduino.svg`** — 홈 ⑤ 카드 (검색어: `circuit`, `maker`)
- [ ] **`step-stats.svg`** — 홈 통계 카드 (검색어: `data`, `charts`)
  - 대체 소스(CC0): openpeeps.com, manypixels.co/gallery
  - 동작: 있으면 카드/히어로에 표시, 없으면 자동으로 사라짐(레이아웃 안 깨짐).

---

## 4. 아이콘  →  `assets/icons/`  (12개 · 코드가 이미 참조 중 · **필수**)

**톤 통일이 중요** → 한 세트로 받기. 모노라인은 **Lucide**(lucide.dev, ISC·표기 불필요),
컬러가 필요한 3개는 **Twemoji**(CC-BY 4.0, 표기 권장) 추천. 규격: **24×24 SVG**.

모노라인 8개 (Lucide에서 "Download SVG"):
- [ ] **`play.svg`** ← Lucide `play` (신호 재생·보내기)
- [ ] **`stop.svg`** ← Lucide `square` (정지)
- [ ] **`sound.svg`** ← Lucide `volume-2` (소리 켜짐)
- [ ] **`mute.svg`** ← Lucide `volume-x` (소리 꺼짐)
- [ ] **`camera.svg`** ← Lucide `camera` (카메라 켜기/통계 출처)
- [ ] **`camera-off.svg`** ← Lucide `camera-off` (카메라 오류)
- [ ] **`refresh.svg`** ← Lucide `rotate-ccw` (인식 초기화·하드웨어 재연결)
- [ ] **`check.svg`** ← Lucide `check` (챌린지 글자 완료)
- [ ] **`telegraph.svg`** ← Lucide `radio-tower` (통계: 전신키 출처)

컬러 3개 (의미상 색이 중요 → Twemoji 컬러 SVG 추천):
- [ ] **`success.svg`** ← Twemoji `1f389` 🎉 또는 Lucide `party-popper` (전송 성공 축하)
- [ ] **`bead-red.svg`** ← Twemoji `1f534` 🔴 (빨강 보정 = 점/빨강 비즈)
- [ ] **`bead-blue.svg`** ← Twemoji `1f535` 🔵 (파랑 보정 = 대시/파랑 비즈)
  - 동작: 있으면 버튼·표시에 나타남, 없으면 **텍스트 라벨만** 표시(이모지/도형 안 씀).

---

## 5. (선택) 배경 사진  →  `assets/img/`

- [ ] **`idle-bg.jpg`** — 대기/홈 배경용 실사진 (원할 때만)
  - 출처: pexels.com / unsplash.com (라이선스 프리, 표기 권장)
  - ※ 이건 **아직 코드에 배선 안 했습니다.** 넣고 알려주시면 대기화면 배경으로 연결해 드립니다.

---

## 넣은 뒤 / 알려주실 것

1. 폰트 넣었으면 → `css/style.css`의 `@font-face` 주석 해제 (직접 또는 저에게 요청).
2. 아이콘·일러스트 넣었으면 → 알려주세요. **크기·여백·정렬 미세조정, 호버 효과**까지 마무리합니다.
3. 라이선스 표기: Lucide·unDraw·Pretendard·IBM Plex는 표기 불필요.
   **Twemoji·사진**만 쓰면 부스 안내판/README에 한 줄 표기 권장 (예: "Icons: Twemoji © Twitter, CC-BY 4.0").

> 참고: 외부 파일은 제가 이 작업 환경에서 직접 내려받을 수 없어(외부망 차단) 받아 넣어주셔야 합니다.
> 모든 슬롯은 파일이 없어도 앱이 정상 동작하도록 폴백 처리돼 있습니다.

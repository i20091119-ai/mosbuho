# 에셋 쇼핑 리스트 (라이선스 프리 · 오프라인 번들용)

부스는 UNO Q에서 **로컬·오프라인**으로 돌아가므로, 외부 이미지는 **다운로드해서 이 폴더에 넣어** 번들합니다(핫링크 X).
아래 파일명을 **그대로** 쓰면 코드가 자동으로 잡습니다. 파일이 없으면 깔끔히 사라지거나 시스템 폰트/도형으로 폴백하니
일부만 넣어도 안전합니다.

> 권장 포맷: **SVG**(벡터 → 4K 모니터에서 또렷, 용량↓). 사진만 예외적으로 PNG/JPG.
> 색은 가능하면 브랜드 팔레트로: 주황 `#F07818`, 파랑 `#1878C0`, 연두 `#78A818`, 보라 `#784890`, 빨강 `#C00018`.

---

## 1) 폰트 — `assets/fonts/` (전부 SIL OFL 1.1)

| 파일명(정확히) | 무엇 | 받는 곳 |
|---|---|---|
| `PretendardVariable.woff2` | 한글 본문(가변, 400~800 전부 커버) | github.com/orioncactus/pretendard → `dist/web/variable` |
| `IBMPlexMono-Regular.woff2` | 숫자·모스 400 | github.com/IBM/plex 또는 fonts.google.com/specimen/IBM+Plex+Mono |
| `IBMPlexMono-SemiBold.woff2` | 〃 600 | 〃 |
| `IBMPlexMono-Bold.woff2` | 〃 700 | 〃 |

→ 넣은 뒤 `css/style.css` 상단의 `@font-face` 주석 블록을 해제하면 끝.

---

## 2) 히어로/단계 일러스트 — `assets/img/`

**추천 소스: unDraw (undraw.co) — CC0(저작권 표기 불필요).** 사이트에서 색을 `#F07818`로 지정 후 SVG 다운로드.

| 파일명(정확히) | 표시 위치 | unDraw 검색어 예 |
|---|---|---|
| `welcome.svg` | 홈 상단 히어로 | `connection`, `code typing`, `engineering team` |
| `step-telegraph.svg` | 홈 ② 카드 | `click here`, `buttons`, `tap` |
| `step-camera.svg` | 홈 ③ 카드 | `camera`, `image scan`, `photos` |
| `step-arduino.svg` | 홈 ⑤ 카드 | `circuit`, `maker`, `settings` |
| `step-stats.svg` | 홈 통계 카드 | `data`, `charts`, `statistics` |

> 대체 소스: openpeeps.com(CC0 인물), drawkit.com(일부 무료), manypixels.co/gallery(CC0).

---

## 3) 버튼·UI 아이콘 — `assets/icons/`

**추천 소스: Lucide (lucide.dev) — ISC 라이선스 / Tabler Icons (tabler.io/icons) — MIT.** 각 아이콘 페이지에서 "Download SVG".
가능하면 stroke 색을 흰색/브랜드색으로. (넣으면 제가 버튼에 배선합니다 — JS가 라벨을 바꾸는 버튼이 있어 정확히 연결 필요)

| 파일명(정확히) | 쓰임 | Lucide 아이콘명 |
|---|---|---|
| `sound.svg` / `mute.svg` | 소리 켜짐/꺼짐 | `volume-2` / `volume-x` |
| `play.svg` / `stop.svg` | 신호 재생/정지 | `play` / `square` |
| `camera.svg` | 카메라 켜기 | `camera` |
| `target.svg` | 도전(챌린지) | `target` |
| `refresh.svg` | 초기화/재연결 | `rotate-ccw` |
| `check.svg` | 확정 | `check` |
| `bulb.svg` | LED/신호 안내 | `lightbulb` |
| `chip.svg` | 아두이노 | `cpu` |

> **친근한 컬러 이모지 스타일**을 원하면: OpenMoji(openmoji.org, CC BY-SA → 저작권 표기 필요) 또는
> Twemoji(github.com/jdecked/twemoji, CC-BY 4.0 → 표기 필요)의 SVG를 받아 같은 파일명으로 저장해도 됩니다.
> (유치~고등 대상이라 컬러 이모지 스타일도 잘 맞습니다.)

---

## 4) (선택) 사진 배경

대기화면 등에 실사진을 쓰려면 **Pexels(pexels.com)·Unsplash(unsplash.com)** — 라이선스 프리(표기 권장).
`assets/img/idle-bg.jpg` 로 저장하면 대기/홈 배경으로 배선해 드립니다. (벡터 일러스트를 더 권장)

---

## 라이선스 표기 메모
- CC0 / Public Domain (unDraw, openpeeps, manypixels): 표기 불필요.
- ISC / MIT (Lucide, Tabler): 표기 불필요(상업·전시 사용 자유).
- CC BY / CC BY-SA (OpenMoji, Twemoji), Pexels/Unsplash 일부: **출처 표기 권장/필요** →
  필요 시 부스 안내판/README 하단에 "Icons: OpenMoji (CC BY-SA 4.0)" 식으로 한 줄 표기.

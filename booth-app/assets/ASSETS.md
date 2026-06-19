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

## 3) 버튼·UI 아이콘 — `assets/icons/` (필수 — 코드가 이미 참조 중)

코드에서 **이모지/도형을 전부 제거**하고 아래 외부 이미지 아이콘을 참조하도록 배선했습니다.
파일을 넣으면 즉시 표시되고, 없으면 **텍스트 라벨로만** 폴백합니다(이모지/도형 폴백 없음).

**추천 소스(택1, 톤 통일이 중요):**
- **Lucide** (lucide.dev) — **ISC, 표기 불필요**. 모노라인, 세련됨 → 각 페이지 "Download SVG".
- **Tabler Icons** (tabler.io/icons) — MIT, 표기 불필요.
- **컬러가 필요한 비즈/성공 아이콘**은 **Twemoji**(CC-BY 4.0, 표기 권장) 컬러 SVG 추천.

| 파일명(정확히) | 쓰임 | 추천 (Lucide / Twemoji 코드) |
|---|---|---|
| `play.svg` | 신호 재생·보내기 | Lucide `play` |
| `stop.svg` | 정지 | Lucide `square` |
| `sound.svg` / `mute.svg` | 소리 켜짐/꺼짐 | Lucide `volume-2` / `volume-x` |
| `camera.svg` | 카메라 켜기/꺼짐 | Lucide `camera` |
| `camera-off.svg` | 카메라 오류 | Lucide `camera-off` |
| `refresh.svg` | 인식 초기화·하드웨어 재연결 | Lucide `rotate-ccw` |
| `check.svg` | 챌린지 글자 완료 | Lucide `check` |
| `success.svg` | 챌린지 전송 성공(축하) | Lucide `party-popper` 또는 Twemoji `1f389` 🎉 |
| `telegraph.svg` | 통계: 전신키 출처 | Lucide `radio-tower` |
| `bead-red.svg` | 빨강 보정(점=빨강 비즈) | Twemoji `1f534` 🔴 (컬러) |
| `bead-blue.svg` | 파랑 보정(대시=파랑 비즈) | Twemoji `1f535` 🔵 (컬러) |

> 권장 규격: **24×24 SVG**, stroke 색은 흰색 또는 브랜드색(`#F07818`/`#784890`). 버튼 안에서 `1.15em` 크기로 렌더됩니다.
> 통계의 카메라 출처 아이콘은 위 `camera.svg`를 공유합니다(별도 파일 불필요).

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

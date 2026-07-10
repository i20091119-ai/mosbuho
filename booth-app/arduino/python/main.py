#!/usr/bin/env python3
# ============================================================================
# main.py — Arduino UNO Q (Linux/MPU 측) 브리지 서버  · App Lab 정식 API 사용
# ----------------------------------------------------------------------------
# 브라우저 부스앱 ↔ 이 서버(HTTP, localhost:8080) ↔ STM32 스케치(RouterBridge)
#
#   출력:  POST /play  {morse,unit} → Bridge.notify("play_morse",…) → LED·부저
#          GET  /status            → {"hw": bool}   (MCU ping 결과)
#   입력:  STM32 가 Bridge.notify("key",1|0) → 파이썬 "key" 핸들러 →
#          GET  /keys (SSE)로 브라우저에 'down'/'up' 푸시 → 전신키 구동
#
# 핵심:
#  - App Lab Python API 는 `from arduino.app_utils import *` (Bridge, App).
#  - Bridge 호출은 전부 App.run 의 user_loop(메인 스레드)에서만 수행 →
#    스레드 안전. HTTP 핸들러는 큐/플래그만 만진다.
#  - 표준 라이브러리만으로 HTTP+SSE (부스 오프라인 동작).
# ============================================================================
import json, queue, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ── App Lab 런타임(보드에 사전 설치). 보드 밖(개발 PC)에선 없을 수 있어 방어적 로드 ──
try:
    from arduino.app_utils import *      # Bridge, App
    HAVE_BRIDGE = True
except Exception as e:
    print("[GNMC] arduino.app_utils 로드 실패 → MCU 없이 HTTP만 동작:", e)
    HAVE_BRIDGE = False

PORT = 8080

# ── 상태 공유 (HTTP 스레드 ↔ 메인 루프) ──────────────────────────────────────
_subs = set(); _subs_lock = threading.Lock()   # SSE 구독자(연결마다 큐 1개)
_play_q = queue.Queue()                          # 브라우저→MCU 재생 요청 큐
_mcu_ok = {"v": False}                            # 메인 루프가 갱신하는 MCU 연결 플래그

def _broadcast(evt: str):
    with _subs_lock:
        for q in list(_subs):
            try: q.put_nowait(evt)
            except Exception: _subs.discard(q)

# STM32 의 Bridge.notify("key", state) 가 호출하는 파이썬 함수 (브리지 스레드 컨텍스트)
def _on_key(state):
    try: s = int(state)
    except Exception: s = 1 if state else 0
    _broadcast('down' if s else 'up')

if HAVE_BRIDGE:
    # 파이썬도 함수를 "제공"해야 MCU가 notify 로 호출할 수 있다(양방향 RPC)
    try:
        Bridge.provide("key", _on_key)
    except Exception as e:
        print("[GNMC] Bridge.provide('key') 실패:", e)


# ── HTTP (브라우저 부스앱이 접속) ────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code, obj):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors(); self.end_headers()
        self.wfile.write(json.dumps(obj).encode())

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):
        if self.path.startswith("/status"):
            self._json(200, {"hw": _mcu_ok["v"]})
        elif self.path.startswith("/keys"):
            self._stream_keys()
        else:
            self._json(404, {"error": "not found"})

    def _stream_keys(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self._cors(); self.end_headers()
        q = queue.Queue()
        with _subs_lock: _subs.add(q)
        try:
            while True:
                try:
                    evt = q.get(timeout=15)
                    self.wfile.write(f"data: {evt}\n\n".encode()); self.wfile.flush()
                except queue.Empty:
                    self.wfile.write(b": ping\n\n"); self.wfile.flush()   # keep-alive
        except Exception:
            pass
        finally:
            with _subs_lock: _subs.discard(q)

    def do_POST(self):
        if not self.path.startswith("/play"):
            self._json(404, {"error": "not found"}); return
        n = int(self.headers.get("Content-Length", 0))
        try: body = json.loads(self.rfile.read(n) or b"{}")
        except Exception: body = {}
        # 직접 Bridge 호출하지 않고 큐에만 넣는다(스레드 안전) → 메인 루프가 전송
        _play_q.put((str(body.get("morse", "")), int(body.get("unit", 120))))
        self._json(200, {"ok": True})

    def log_message(self, *a):
        pass


def _serve_http():
    print(f"[GNMC] 부스 브리지 HTTP 시작 http://localhost:{PORT}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


# ── 메인 루프(App.run): 모든 Bridge 접근은 여기서만 ──────────────────────────
_last_ping = {"t": 0.0}

def loop():
    # 1) 브라우저가 요청한 재생을 MCU로 전송 (notify = 응답 안 기다림, 재생 중 블로킹 회피)
    try:
        while True:
            morse, unit = _play_q.get_nowait()
            try: Bridge.notify("play_morse", morse, int(unit))
            except Exception as e: print("[GNMC] play_morse 전송 실패:", e)
    except queue.Empty:
        pass
    # 2) 2초마다 MCU 연결 확인(ping) → /status 플래그 갱신
    now = time.time()
    if now - _last_ping["t"] > 2.0:
        _last_ping["t"] = now
        try: _mcu_ok["v"] = bool(Bridge.call("ping"))
        except Exception: _mcu_ok["v"] = False
    time.sleep(0.02)


# HTTP 서버는 데몬 스레드로(브라우저는 Bridge 연결 여부와 무관하게 접속 가능)
threading.Thread(target=_serve_http, daemon=True).start()

if HAVE_BRIDGE:
    # App.run 이 브리지를 초기화/펌프하며 user_loop 를 반복 호출한다
    try:
        App.run(user_loop=loop)
    except TypeError:
        App.run(loop)            # 시그니처 차이 방어
else:
    # 보드 밖(개발 PC): Bridge 없이 HTTP만 유지
    while True:
        time.sleep(1)

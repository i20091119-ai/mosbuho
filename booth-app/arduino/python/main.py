#!/usr/bin/env python3
# ============================================================================
# main.py — Arduino UNO Q (Linux/MPU 측) 브리지 서버
# ----------------------------------------------------------------------------
# 브라우저 부스앱 ↔ 이 서버 ↔ STM32 스케치(RouterBridge)
#
#   출력:  POST /play  {morse,unit}  → Bridge.call("play_morse")  → LED·부저
#          GET  /status              → {"hw": bool}               (연결 확인)
#   입력:  STM32 가 Bridge.notify("key",1|0) → 이 서버가 받아
#          GET  /keys (SSE 스트림)으로 브라우저에 'down'/'up' 푸시 → 전신키 구동
#
# 표준 라이브러리만 사용(SSE 포함) → 부스 인터넷 없이 동작.
# ============================================================================
import json, queue, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ── Bridge 연결 (App Lab Python 측 API; 버전 차이 방어적 로드) ──
bridge = None
try:
    from arduino.bridge import Bridge          # 경로는 App Lab 버전따라 다를 수 있음
    bridge = Bridge()
except Exception:
    try:
        from arduino_router import Bridge
        bridge = Bridge()
    except Exception:
        bridge = None

# ── 버튼 이벤트 구독자(SSE 연결마다 큐 1개) ──
_subs = set()
_subs_lock = threading.Lock()

def _broadcast(evt: str):
    with _subs_lock:
        dead = []
        for q in _subs:
            try: q.put_nowait(evt)
            except Exception: dead.append(q)
        for q in dead: _subs.discard(q)

def _on_key(state):
    # STM32 가 Bridge.notify("key", 1|0) 로 호출 → 브라우저로 전달
    try: s = int(state)
    except Exception: s = 1 if state else 0
    _broadcast('down' if s else 'up')

# STM32 의 "key" 통지를 받도록 Python 측에 핸들러 등록(가능하면)
if bridge is not None:
    for reg in ('provide', 'on', 'register'):
        try:
            getattr(bridge, reg)("key", _on_key); break
        except Exception:
            continue


def mcu_available() -> bool:
    if bridge is None: return False
    try: return bool(bridge.call("ping"))
    except Exception: return False

def send_to_mcu(morse: str, unit: int) -> bool:
    if bridge is None: return False
    try: bridge.call("play_morse", morse, int(unit)); return True
    except Exception as e:
        print("[bridge] play_morse 실패:", e); return False


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
            self._json(200, {"hw": mcu_available()})
        elif self.path.startswith("/keys"):
            self._stream_keys()
        else:
            self._json(404, {"error": "not found"})

    def _stream_keys(self):
        # Server-Sent Events: 버튼 down/up 를 브라우저로 실시간 푸시
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
                    self.wfile.write(b": ping\n\n"); self.wfile.flush()  # keep-alive
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
        ok = send_to_mcu(str(body.get("morse", "")), int(body.get("unit", 120)))
        self._json(200, {"ok": ok})

    def log_message(self, *a):
        pass


def main(host="0.0.0.0", port=8080):
    print(f"[GNMC] 부스 브리지 시작 http://localhost:{port}  (MCU: {mcu_available()})")
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()

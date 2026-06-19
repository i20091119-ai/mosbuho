#!/usr/bin/env python3
# ============================================================================
# main.py — Arduino UNO Q (Linux/MPU 측) 브리지 HTTP 서버
# ----------------------------------------------------------------------------
# 브라우저 부스앱(http://localhost) ↔ 이 서버 ↔ STM32 스케치(Bridge RPC)
#
#   웹앱 fetch:  GET  /status        → {"hw": true/false}   (연결 확인)
#               POST /play {morse,unit} → STM32 의 play_morse 호출
#
# RouterBridge 로 MCU 의 play_morse(morse, unit) 를 호출한다.
# 표준 라이브러리(http.server)만 사용 → 부스 인터넷 없이도 동작.
#
# 실행: Arduino App Lab 이 이 앱을 실행하면 python 은 MPU 에서,
#       sketch 는 MCU 에서 함께 구동된다. (../README.md 참고)
# ============================================================================
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ── Bridge 연결 (App Lab Python 측 API) ─────────────────────────────────────
# 설치된 App Lab 버전에 따라 import 경로/호출 방식이 다를 수 있어 방어적으로 로드.
# 스케치는 Bridge.provide("play_morse", ...) 로 함수를 등록해 둔다.
bridge = None
try:
    # App Lab 표준 경로 (버전에 따라 arduino.app_bridge / arduino.bridge 등)
    from arduino.bridge import Bridge  # type: ignore
    bridge = Bridge()
except Exception:
    try:
        from arduino_router import Bridge  # type: ignore
        bridge = Bridge()
    except Exception:
        bridge = None  # 미연결 → 웹앱은 자동으로 시뮬레이션 폴백


def mcu_available() -> bool:
    if bridge is None:
        return False
    try:
        # 등록된 ping() 으로 살아있는지 확인
        return bool(bridge.call("ping"))
    except Exception:
        return False


def send_to_mcu(morse: str, unit: int) -> bool:
    """STM32 의 play_morse(morse, unit) 호출. 성공 시 True."""
    if bridge is None:
        return False
    try:
        bridge.call("play_morse", morse, int(unit))
        return True
    except Exception as e:
        print("[bridge] play_morse 실패:", e)
        return False


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code, obj):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(obj).encode())

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):
        if self.path.startswith("/status"):
            self._json(200, {"hw": mcu_available()})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if not self.path.startswith("/play"):
            self._json(404, {"error": "not found"}); return
        length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            body = {}
        morse = str(body.get("morse", ""))
        unit = int(body.get("unit", 120))
        ok = send_to_mcu(morse, unit)
        self._json(200, {"ok": ok, "morse": morse, "unit": unit})

    def log_message(self, *args):
        pass  # 콘솔 소음 억제


def main(host="0.0.0.0", port=8080):
    print(f"[GNMC] 부스 브리지 서버 시작 http://localhost:{port}  (MCU 연결: {mcu_available()})")
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()

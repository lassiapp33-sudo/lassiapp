"""
Screen Server — capture écran Windows → HTTP → Chrome
Accès : http://localhost:8765
"""
import io, threading, time
import pyautogui
from flask import Flask, Response, send_file

app = Flask(__name__)
_frame = b""
_lock  = threading.Lock()

def capture_loop():
    global _frame
    while True:
        try:
            img = pyautogui.screenshot()
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=75)
            with _lock:
                _frame = buf.getvalue()
        except Exception as e:
            print(f"Capture error: {e}")
        time.sleep(0.4)  # ~2.5 fps

@app.route("/")
def index():
    return """<!DOCTYPE html>
<html><head>
<title>Blender Live View</title>
<style>body{margin:0;background:#111;display:flex;justify-content:center;align-items:flex-start}
img{max-width:100%;height:auto;display:block}</style>
</head><body>
<img id="s" src="/frame">
<script>
  function refresh(){
    var img=document.getElementById('s');
    var src='/frame?t='+Date.now();
    var tmp=new Image();
    tmp.onload=function(){img.src=src;setTimeout(refresh,400)};
    tmp.onerror=function(){setTimeout(refresh,400)};
    tmp.src=src;
  }
  refresh();
</script>
</body></html>"""

@app.route("/frame")
def frame():
    with _lock:
        data = _frame
    if not data:
        return Response("loading...", status=503)
    return send_file(io.BytesIO(data), mimetype="image/jpeg",
                     max_age=0)

if __name__ == "__main__":
    t = threading.Thread(target=capture_loop, daemon=True)
    t.start()
    print("Screen server demarre -> http://localhost:8765")
    app.run(host="127.0.0.1", port=8765, debug=False, use_reloader=False)

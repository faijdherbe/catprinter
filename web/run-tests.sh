#!/bin/sh
# Run web/test.html in headless Chrome. Print "ok", or "FAIL" and the failed checks.
cd "$(dirname "$0")" || exit 1
python3 -m http.server 8765 >/dev/null 2>&1 &
pid=$!
sleep 1
out=$(google-chrome --headless=new --disable-gpu --virtual-time-budget=300000 --dump-dom http://localhost:8765/test.html 2>/dev/null |
  python3 -c 'import re, sys; m = re.search(r"<pre id=\"out\">(.*?)</pre>", sys.stdin.read(), re.S); print(m.group(1) if m else "no output")')
kill $pid
echo "$out"
[ "$out" = ok ]

from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("server.py")
s = p.read_text(encoding="utf-8")

route = '@app.route("/api/chat", methods=["POST"])'
start = s.find(route)
if start < 0:
    raise SystemExit("STOP: /api/chat route nahi mila.")

end = s.find("\n@app.route(", start + len(route))
if end < 0:
    end = len(s)

chat = s[start:end]

pattern = re.compile(
    r'    api_key = os\.environ\.get\("GROQ_API_KEY", ""\)\.strip\(\)\s*'
    r'if not api_key:\s*'
    r'return jsonify\(\{\s*'
    r'"error": "GROQ_API_KEY is missing from the server environment\."\s*'
    r'\}\), 500\s*',
    re.MULTILINE
)

matches = list(pattern.finditer(chat))
if len(matches) != 1:
    raise SystemExit(
        f"STOP: /api/chat mein expected 1 API-key block, mila {len(matches)}. File unchanged."
    )

api_block = matches[0].group(0)
chat = pattern.sub("", chat, count=1)

anchor = '''    if not user_message:
        return jsonify({"error": "Please enter a message."}), 400

'''
if chat.count(anchor) != 1:
    raise SystemExit("STOP: safe insertion point nahi mila. File unchanged.")

chat = chat.replace(anchor, anchor + "\n" + api_block, 1)

updated = s[:start] + chat + s[end:]
compile(updated, str(p), "exec")

backup = p.with_name(
    f"server.py.before-api-order-fix-{datetime.now():%Y%m%d-%H%M%S}.bak"
)
shutil.copy2(p, backup)
p.write_text(updated, encoding="utf-8", newline="\n")

print("PATCH OK")
print("Backup:", backup)
print("Python syntax: PASS")

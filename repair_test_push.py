from pathlib import Path
from datetime import datetime
import shutil
import subprocess
import sys

p = Path("server.py")
original = p.read_text(encoding="utf-8")

route = '@app.route("/api/chat", methods=["POST"])'
start = original.find(route)
if start < 0:
    sys.exit("STOP: /api/chat route nahi mila.")

end = original.find("\n@app.route(", start + len(route))
if end < 0:
    end = len(original)

chat = original[start:end]
api_start = chat.find('    api_key = os.environ.get("GROQ_API_KEY", "").strip()')
data_start = chat.find("    data = request.get_json(silent=True) or {}", api_start)

if api_start < 0 or data_start < 0:
    sys.exit("STOP: API-key block nahi mila. File unchanged.")

api_block = chat[api_start:data_start]
chat = chat[:api_start] + chat[data_start:]

anchor = '''    if not user_message:
        return jsonify({"error": "Please enter a message."}), 400

'''
if chat.count(anchor) != 1:
    sys.exit("STOP: insertion point nahi mila. File unchanged.")

chat = chat.replace(anchor, anchor + api_block, 1)
updated = original[:start] + chat + original[end:]

# Generic bio mein Instagram link nahi dikhana.
updated = updated.replace(
    '''                "AI-powered projects. His Instagram ID is "
                "@manasmishra_.x: "
                "https://www.instagram.com/manasmishra_.x/"
''',
    '''                "AI-powered projects."
'''
)

try:
    compile(updated, str(p), "exec")
except SyntaxError as e:
    sys.exit(f"STOP: syntax check failed; original unchanged: {e}")

backup = p.with_name(
    f"server.py.before-final-repair-{datetime.now():%Y%m%d-%H%M%S}.bak"
)
shutil.copy2(p, backup)
p.write_text(updated, encoding="utf-8", newline="\n")
print("Backup created:", backup)

try:
    import server

    client = server.app.test_client()
    tests = [
        ("Who made you?", "Manas Mishra"),
        ("Tell me about Manas Mishra", "Class 9"),
        ("What is Manas Mishra's Instagram?", "@manasmishra_.x"),
    ]

    for question, expected in tests:
        response = client.post("/api/chat", json={"message": question})
        body = response.get_json(silent=True) or {}
        answer = body.get("response") or body.get("answer") or body.get("reply") or ""
        if response.status_code != 200 or expected.lower() not in answer.lower():
            raise RuntimeError(
                f"Test failed for {question!r}: HTTP {response.status_code}, "
                f"response={body}"
            )
        print("PASS:", question)

except Exception as e:
    p.write_text(original, encoding="utf-8", newline="\n")
    print("TEST FAILED; server.py restored. No push performed.")
    print(repr(e))
    sys.exit(1)

def run(args):
    result = subprocess.run(args, text=True)
    if result.returncode:
        sys.exit(f"STOP: command failed: {' '.join(args)}")

branch = subprocess.check_output(
    ["git", "branch", "--show-current"], text=True
).strip()
if branch != "main":
    p.write_text(original, encoding="utf-8", newline="\n")
    sys.exit(f"Tests passed, but current branch is {branch!r}, not main. No push.")

staged = subprocess.run(["git", "diff", "--cached", "--quiet"])
if staged.returncode != 0:
    p.write_text(original, encoding="utf-8", newline="\n")
    sys.exit("Tests passed, but unrelated staged changes exist. No push; server.py restored.")

run(["python", "-m", "py_compile", "server.py"])
run(["git", "add", "--", "server.py"])
run(["git", "commit", "--only", "-m", "Fix NavAI creator profile responses", "--", "server.py"])
run(["git", "push", "origin", "main"])

print("SUCCESS: tested server.py pushed to origin/main.")
print("Render deployment may take a few minutes.")

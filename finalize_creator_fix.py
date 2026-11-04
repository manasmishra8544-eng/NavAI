from pathlib import Path
from datetime import datetime
import re, shutil, subprocess, sys

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

creator_old = '''        elif creator_question and not about_manas:
            answer = (
                "NavAI was created and developed by Manas Mishra "
                "using code, AI models, and development tools. "
                "It is his own project."
            )
'''
creator_new = '''        elif creator_question and not about_manas:
            hinglish_query = bool(re.search(
                r"\\b(tumhe|tumko|kisne|banaya|kaun|kya|hai|batao|"
                r"bataiye|chahiye|baare|bare|janana|janna|bata)\\b",
                user_message, re.IGNORECASE
            ))
            if hinglish_query:
                answer = (
                    "NavAI ko Manas Mishra ne code, AI models aur "
                    "development tools ka use karke banaya hai. "
                    "Yeh unka apna project hai. Kya aap Manas Mishra "
                    "ke baare mein kuch aur jaanna chahenge?"
                )
            else:
                answer = (
                    "NavAI was created and developed by Manas Mishra "
                    "using code, AI models, and development tools. "
                    "It is his own project. Would you like to know "
                    "more about Manas Mishra?"
                )
'''

if chat.count(creator_old) != 1:
    sys.exit("STOP: creator block match nahi hua. File unchanged.")
chat = chat.replace(creator_old, creator_new, 1)

bio_old = '''                "He works on improving NavAI and building useful "
                "AI-powered projects."
'''
bio_new = '''                "He works on improving NavAI and building useful "
                "AI-powered projects. His Instagram ID is "
                "@manasmishra_.x. Profile: "
                "https://www.instagram.com/manasmishra_.x/"
'''
if chat.count(bio_old) != 1:
    sys.exit("STOP: bio block match nahi hua. File unchanged.")
chat = chat.replace(bio_old, bio_new, 1)

updated = original[:start] + chat + original[end:]
try:
    compile(updated, str(p), "exec")
except SyntaxError as e:
    sys.exit(f"STOP: syntax error; file unchanged: {e}")

backup = p.with_name(
    f"server.py.before-creator-final-{datetime.now():%Y%m%d-%H%M%S}.bak"
)
shutil.copy2(p, backup)
p.write_text(updated, encoding="utf-8", newline="\n")
print("Backup:", backup)

try:
    import server
    client = server.app.test_client()
    tests = [
        ("Who made you?", "Would you like to know more about Manas Mishra?"),
        ("Tumhe kisne banaya?", "Kya aap Manas Mishra ke baare mein kuch aur jaanna chahenge?"),
        ("Tell me about Manas Mishra", "https://www.instagram.com/manasmishra_.x/"),
        ("What is Manas Mishra's Instagram?", "@manasmishra_.x"),
    ]
    for question, expected in tests:
        response = client.post("/api/chat", json={"message": question})
        data = response.get_json(silent=True) or {}
        answer = data.get("response") or data.get("answer") or data.get("reply") or ""
        if response.status_code != 200 or expected.lower() not in answer.lower():
            raise RuntimeError(
                f"{question!r}: HTTP {response.status_code}; response={data}"
            )
        print("PASS:", question)
except Exception as e:
    p.write_text(original, encoding="utf-8", newline="\n")
    sys.exit(f"TEST FAILED: original server.py restored; no push. {e}")

if subprocess.check_output(
    ["git", "branch", "--show-current"], text=True
).strip() != "main":
    p.write_text(original, encoding="utf-8", newline="\n")
    sys.exit("STOP: current branch main nahi hai; original file restored.")

if subprocess.run(["git", "diff", "--cached", "--quiet"]).returncode != 0:
    p.write_text(original, encoding="utf-8", newline="\n")
    sys.exit("STOP: pehle se staged changes hain; original file restored.")

commands = [
    ["python", "-m", "py_compile", "server.py"],
    ["git", "add", "--", "server.py"],
    ["git", "commit", "--only", "-m", "Improve NavAI creator answers", "--", "server.py"],
    ["git", "push", "origin", "main"],
]
for cmd in commands:
    print("RUN:", " ".join(cmd))
    result = subprocess.run(cmd)
    if result.returncode:
        sys.exit(f"STOP: command failed ({result.returncode}). Output check karo.")

print("SUCCESS: tested and pushed server.py to GitHub main.")
print("Render deploy hone mein kuch minutes lag sakte hain.")

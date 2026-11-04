from pathlib import Path
from datetime import datetime
import shutil
import re

p = Path("server.py")
s = p.read_text(encoding="utf-8")

api_block = '''    api_key = os.environ.get("GROQ_API_KEY", "").strip()

    if not api_key:
        return jsonify({
            "error": "GROQ_API_KEY is missing from the server environment."
        }), 500

'''
if s.count(api_block) != 1:
    raise SystemExit("STOP: API-key block ka exact match nahi mila. File unchanged.")

if "# NAVAI_CREATOR_PROFILE_V2" not in s:
    raise SystemExit("STOP: Creator profile marker nahi mila. File unchanged.")

backup = p.with_name(
    f"server.py.before-final-profile-fix-{datetime.now():%Y%m%d-%H%M%S}.bak"
)
shutil.copy2(p, backup)

s = s.replace(api_block, "", 1)

anchor = '''    if not user_message:
        return jsonify({"error": "Please enter a message."}), 400

'''
if s.count(anchor) != 1:
    shutil.copy2(backup, p)
    raise SystemExit("STOP: API-key check insert point nahi mila; backup se restore kiya.")

s = s.replace(anchor, anchor + api_block, 1)

# Generic "about me" requests should not expose Manas's profile.
s = s.replace(
    'r"(manas\\\\s+mishra|mere\\\\s+baare\\\\s+mein|mere\\\\s+bare\\\\s+mein|"',
    'r"(manas\\\\s+mishra|about\\\\s+the\\\\s+creator|navai\\\\s+creator|"'
)
s = s.replace(
    'r"mere\\\\s+baare\\\\s+me|mere\\\\s+bare\\\\s+me|"',
    ''
)
s = s.replace(
    'r"about\\\\s+me|tell\\\\s+me\\\\s+about\\\\s+myself|"',
    ''
)
s = s.replace('r"my\\\\s+instagram|manas.*instagram|"', 'r"manas.*instagram|"')

# Keep social media details for explicit social-profile questions only.
s = s.replace(
    '''                "AI-powered projects. His Instagram ID is "
                "@manasmishra_.x: "
                "https://www.instagram.com/manasmishra_.x/"
''',
    '''                "AI-powered projects."
'''
)

p.write_text(s, encoding="utf-8", newline="\n")
compile(s, str(p), "exec")
print("PATCH OK")
print("Backup:", backup)
print("Python syntax: PASS")

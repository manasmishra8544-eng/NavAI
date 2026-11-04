from pathlib import Path
from datetime import datetime
import re
import py_compile
import shutil
import sys

p = Path("server.py")
if not p.exists():
    sys.exit("ERROR: server.py nahi mila. Sahi project folder kholo.")

src = p.read_text(encoding="utf-8")
start = src.find("    # NAVAI_CREATOR_DIRECT_FIX")
end = src.find("    if not user_message:", start)

if start < 0 or end < 0:
    sys.exit("ERROR: Expected code section nahi mila. File unchanged hai.")

backup = p.with_name(
    "server.py.before-manash-profile-" +
    datetime.now().strftime("%Y%m%d-%H%M%S") + ".bak"
)
shutil.copy2(p, backup)

replacement = r'''    # NAVAI_CREATOR_PROFILE_V2
    creator_question = re.search(
        r"(who\s+(made|created|built|developed)\s+you|"
        r"who\s+is\s+your\s+(creator|developer|maker)|"
        r"who\s+is\s+behind\s+you|"
        r"tumhe?\s+kisne\s+banaya|"
        r"tumhara\s+(creator|developer|maker)\s+kaun|"
        r"kisne\s+banaya\s+navai|"
        r"how\s+were\s+you\s+(made|created|built|developed))",
        user_message, re.IGNORECASE
    )

    about_manas = re.search(
        r"(manas\s+mishra|mere\s+baare\s+mein|mere\s+bare\s+mein|"
        r"mere\s+baare\s+me|mere\s+bare\s+me|"
        r"about\s+me|tell\s+me\s+about\s+myself|"
        r"my\s+instagram|manas.*instagram|"
        r"instagram.*manas|manas.*(kaun|who|kahan|where|kya\s+karta)|"
        r"(who|where|what).*manas)",
        user_message, re.IGNORECASE
    )

    if creator_question or about_manas:
        social_question = re.search(
            r"(instagram|insta|social\s+media|social\s+profile)",
            user_message, re.IGNORECASE
        )
        location_question = re.search(
            r"(where|kahan|location|from\s+where|kahan\s+se)",
            user_message, re.IGNORECASE
        )

        if social_question:
            answer = (
                "Manas Mishra's Instagram ID is @manasmishra_.x. "
                "Profile: https://www.instagram.com/manasmishra_.x/"
            )
        elif location_question:
            answer = (
                "Manas Mishra is from Gonda, Uttar Pradesh, India."
            )
        elif creator_question and not about_manas:
            answer = (
                "NavAI was created and developed by Manas Mishra "
                "using code, AI models, and development tools. "
                "It is his own project."
            )
        else:
            answer = (
                "Manas Mishra is the creator and developer of NavAI. "
                "He is 16 years old and studies in Class 9. "
                "He is from Gonda, Uttar Pradesh, India, and is "
                "interested in coding, artificial intelligence, and "
                "website development. His project, NavAI, brings "
                "together four tools: NavAI Chatbot, NavAI Teacher, "
                "NavAI Homework Helper, and NavAI Website Creator. "
                "He works on improving NavAI and building useful "
                "AI-powered projects. His Instagram ID is "
                "@manasmishra_.x: "
                "https://www.instagram.com/manasmishra_.x/"
            )

        return jsonify({
            "response": answer,
            "answer": answer,
            "reply": answer
        })

'''
updated = src[:start] + replacement + src[end:]

try:
    p.write_text(updated, encoding="utf-8", newline="")
    py_compile.compile(str(p), doraise=True)
except Exception as exc:
    shutil.copy2(backup, p)
    sys.exit(f"ERROR: Update/validation failed; backup restored. {exc}")

print("SUCCESS: Creator profile updated.")
print(f"Backup: {backup}")
print("Python syntax check: PASSED")
print("Next: test locally before deploying.")

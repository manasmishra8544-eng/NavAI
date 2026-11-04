from pathlib import Path
p = Path("server.py")
s = p.read_text(encoding="utf-8-sig")
marker = "- Be friendly, accurate, and useful."

if marker not in s:
    raise SystemExit("ERROR: Prompt marker not found; file unchanged.")

addition = """
- NavAI's main chatbot can discuss everyday life, jokes, hobbies, entertainment,
  technology, coding, creative ideas, and general knowledge—not only schoolwork.
- Follow the user's topic naturally and keep specialized NavAI features available.
"""

if "NAVAI_ALL_PURPOSE_CHAT_ADDON_V1" not in s:
    s = s.replace(
        marker,
        marker + "\nNAVAI_ALL_PURPOSE_CHAT_ADDON_V1\n" + addition,
        1
    )

p.write_text(s, encoding="utf-8", newline="\n")
print("Restored original prompt and added the small all-purpose-chat rule.")

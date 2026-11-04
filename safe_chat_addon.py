from pathlib import Path
import sys

p = Path("server.py")
data = p.read_bytes()
marker = b"- Be friendly, accurate, and useful."

if data.count(marker) != 1:
    sys.exit("ERROR: Prompt marker is not unique. No changes made.")

if b"NAVAI_ALL_PURPOSE_CHAT_ADDON_V1" in data:
    sys.exit("ERROR: Addon already exists. No changes made.")

nl = b"\r\n" if b"\r\n" in data else b"\n"
addition = (
    "\nNAVAI_ALL_PURPOSE_CHAT_ADDON_V1\n"
    "- NavAI's main chatbot can discuss everyday life, jokes, hobbies, entertainment,\n"
    "  technology, coding, creative ideas, and general knowledge\u2014not only schoolwork.\n"
    "- Follow the user's topic naturally and keep specialized NavAI features available."
).encode("utf-8").replace(b"\n", nl)

data = data.replace(marker, marker + addition, 1)
p.write_bytes(data)
print("Chat addon added.")

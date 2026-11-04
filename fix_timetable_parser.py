from pathlib import Path
import re

p = Path("server.py")
s = p.read_text(encoding="utf-8-sig")

old = '''        content = str(response.json()["choices"][0]["message"]["content"]).strip()
        content = re.sub(r"^```(?:json)?\\s*|\\s*```$", "", content, flags=re.I)
        result = __import__("json").loads(content)

        if not isinstance(result, dict) or not isinstance(result.get("days"), list):
            raise ValueError("Invalid timetable")
'''

new = '''        message = response.json()["choices"][0]["message"]
        content = message.get("content", "")
        if isinstance(content, list):
            content = "".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in content
            )
        content = str(content or "").strip()
        content = re.sub(r"```(?:json)?", "", content, flags=re.I).strip()

        decoder = __import__("json").JSONDecoder()
        result = None
        for position, character in enumerate(content):
            if character == "{":
                try:
                    candidate, _ = decoder.raw_decode(content[position:])
                    if isinstance(candidate, dict) and isinstance(candidate.get("days"), list):
                        result = candidate
                        break
                except ValueError:
                    continue

        if result is None:
            print("Timetable AI raw response:", content[:1500])
            raise ValueError("AI response did not contain valid timetable JSON")
'''

if old not in s:
    raise SystemExit("Parser block not found. No changes made.")

backup = p.with_name("server-before-timetable-parser-fix.py")
backup.write_text(s, encoding="utf-8")
p.write_text(s.replace(old, new, 1), encoding="utf-8")

print("Timetable response parser updated. Backup:", backup.name)

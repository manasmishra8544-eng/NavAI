from pathlib import Path
import re
import shutil
import subprocess
import sys
from datetime import datetime

p = Path("server.py")
if not p.exists():
    print("ERROR: Desktop\\NavAI-Git mein server.py nahi mila.")
    raise SystemExit(1)

s = p.read_text(encoding="utf-8-sig")
backup = p.with_name(
    "server.py.backup-" + datetime.now().strftime("%Y%m%d-%H%M%S")
)
shutil.copy2(p, backup)

# Remove potentially incompatible optional request fields.
s = re.sub(
    r'(?m)^\s*payload\["citation_options"\]\s*=\s*.*\n',
    "",
    s
)
s = re.sub(
    r'(?m)^\s*payload\["reasoning_effort"\]\s*=\s*.*\n',
    "",
    s
)

p.write_text(s, encoding="utf-8")

check = subprocess.run(
    [sys.executable, "-m", "py_compile", str(p)],
    capture_output=True, text=True
)

if check.returncode:
    shutil.copy2(backup, p)
    print("ERROR: Original file restored.")
    print(check.stderr)
    raise SystemExit(1)

print("Fix applied. Backup:", backup.name)
print("Python syntax check passed.")

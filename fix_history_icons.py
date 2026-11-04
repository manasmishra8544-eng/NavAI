from pathlib import Path
import re

p = Path("script.js")
s = p.read_text(encoding="utf-8")
Path("script.js.before-history-icon-fix.bak").write_text(s, encoding="utf-8")

s = s.replace('del.textContent = "Ã—";', 'del.textContent = "\\u00D7";')
p.write_text(s, encoding="utf-8")

p = Path("sidebar-enhancement.js")
s = p.read_text(encoding="utf-8")
Path("sidebar-enhancement.js.before-history-icon-fix.bak").write_text(s, encoding="utf-8")

s = re.sub(
    r'(#chatHistory \.history-item \.history-item-icon,.*?display:\s*)none\s*!important;',
    r'\1inline-flex !important;',
    s,
    count=1,
    flags=re.S
)
s = re.sub(
    r'(#chatHistory \.history-item \.delete-btn\s*\{[^}]*display:\s*)none\s*!important;',
    r'\1inline-flex !important;',
    s,
    count=1,
    flags=re.S
)
s = s.replace(
    '#chatHistory .history-item .history-item-delete,',
    '#chatHistory .history-item .history-item-delete,'
)
p.write_text(s, encoding="utf-8")
print("History icon repair applied. Backups created.")

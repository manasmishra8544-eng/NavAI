from pathlib import Path
from datetime import datetime
import shutil, subprocess, sys

p = Path("script.js")
original = p.read_text(encoding="utf-8")

marker = 'function renderMarkdown(text) {'
if original.count(marker) != 1:
    sys.exit("STOP: renderMarkdown function unique nahi mila. File unchanged.")

# URLs ko HTML-safe anchor mein convert karne ke liye helper add karo.
helper = r'''
function linkifySafeUrls(html) {
    const urlPattern = /https?:\/\/[^\s<>"']+/gi;
    return html.replace(urlPattern, function (rawUrl) {
        let url = rawUrl;
        let trailing = "";

        while (/[),.!?;:]$/.test(url)) {
            trailing = url.slice(-1) + trailing;
            url = url.slice(0, -1);
        }

        const safeUrl = url.replace(/&amp;/g, "&");
        let parsed;
        try {
            parsed = new URL(safeUrl);
        } catch {
            return rawUrl;
        }

        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return rawUrl;
        }

        const href = parsed.href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        const label = url;
        return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' +
            label + '</a>' + trailing;
    });
}

'''

if "function linkifySafeUrls(html)" not in original:
    original = original.replace(marker, helper + marker, 1)

# Markdown HTML banne ke baad safe URLs ko links banao.
needle = "    return html;"
if original.count(needle) < 1:
    sys.exit("STOP: renderMarkdown return point locate nahi hua. File unchanged.")

start = original.find(marker)
end = original.find("\n}", start)
function = original[start:end + 2]

if "linkifySafeUrls(html)" not in function:
    if needle not in function:
        sys.exit("STOP: renderMarkdown return point locate nahi hua. File unchanged.")
    function = function.replace(needle, "    html = linkifySafeUrls(html);\n    return html;", 1)
    original = original[:start] + function + original[end + 2:]

try:
    import subprocess
    check = subprocess.run(
        ["node", "--check", "script.js"],
        capture_output=True, text=True
    )
    if check.returncode == 0:
        pass
    elif "not recognized" not in (check.stderr + check.stdout).lower() and "not found" not in (check.stderr + check.stdout).lower():
        print(check.stdout, check.stderr)
        sys.exit("STOP: JavaScript syntax check failed; file unchanged.")
except FileNotFoundError:
    pass

p = Path("script.js")
backup = p.with_name(
    f"script.js.before-clickable-links-{datetime.now():%Y%m%d-%H%M%S}.bak"
)
shutil.copy2(p, backup)
p.write_text(original, encoding="utf-8", newline="\n")
print("Backup:", backup)
print("UPDATED: assistant message URLs now render as clickable links.")
print("Next: browser mein refresh karke Instagram link test karo.")

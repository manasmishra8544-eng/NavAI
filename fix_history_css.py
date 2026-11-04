from pathlib import Path

p = Path("sidebar-enhancement.js")
s = p.read_text(encoding="utf-8")

marker = "#chatHistory .history-item .history-item-icon {"
if marker not in s:
    s += """

const navaiHistoryIconFix = document.createElement("style");
navaiHistoryIconFix.textContent = `
  #chatHistory .history-item .history-item-icon {
    display: inline-flex !important;
    visibility: visible !important;
  }
  #chatHistory .history-item .delete-chat-button {
    display: inline-flex !important;
    visibility: visible !important;
    opacity: 1 !important;
  }
`;
document.head.appendChild(navaiHistoryIconFix);
"""
    p.write_text(s, encoding="utf-8")
    print("Chat history icon CSS added.")
else:
    print("Icon fix marker already exists; no duplicate added.")

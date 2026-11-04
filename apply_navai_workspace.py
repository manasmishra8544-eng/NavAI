from pathlib import Path
from datetime import datetime
import shutil
import sys

root = Path.cwd()
files = ["index.html", "style.css", "script.js", "server.py", "requirements.txt"]
for name in files:
    if not (root / name).exists():
        print("ERROR: Missing file:", name)
        sys.exit(1)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = root.parent / f"NavAI-Backup-Update-{stamp}"
backup.mkdir()
for name in files:
    shutil.copy2(root / name, backup / name)

html = (root / "index.html").read_text(encoding="utf-8")
css = (root / "style.css").read_text(encoding="utf-8")
js = (root / "script.js").read_text(encoding="utf-8")

sidebar_anchor = '            <div class="sidebar-bottom">'
modal_anchor = '    <script src="/script.js"></script>'
theme_anchor = '/* THEME */'

if 'id="libraryBtn"' in html or 'id="navaiWorkspace"' in html:
    print("Workspace update already appears to be installed. No changes made.")
    print("Backup:", backup)
    sys.exit(0)

if sidebar_anchor not in html or modal_anchor not in html or theme_anchor not in js:
    print("ERROR: Expected insertion point not found. No changes made.")
    print("Backup:", backup)
    sys.exit(1)

sidebar = """            <div class="workspace-nav">
                <div class="workspace-nav-heading">YOUR WORKSPACE</div>
                <button class="sidebar-action" id="libraryBtn" type="button">
                    <span class="action-icon">▤</span><span>Library</span>
                </button>
                <button class="sidebar-action" id="tasksBtn" type="button">
                    <span class="action-icon">◷</span><span>Scheduled tasks</span>
                </button>
                <button class="sidebar-action" id="codingBtn" type="button">
                    <span class="action-icon">&lt;/&gt;</span><span>Coding workspace</span>
                </button>
            </div>

"""

modal = r"""
    <div class="workspace-backdrop hidden" id="navaiWorkspace" role="dialog" aria-modal="true" aria-labelledby="workspaceTitle">
        <section class="workspace-window">
            <header class="workspace-header">
                <div>
                    <div class="workspace-kicker">NAVAI WORKSPACE</div>
                    <h2 id="workspaceTitle">Your workspace</h2>
                </div>
                <button type="button" class="workspace-close" id="workspaceClose" aria-label="Close workspace">×</button>
            </header>

            <nav class="workspace-tabs" aria-label="Workspace sections">
                <button type="button" class="workspace-tab active" data-panel="libraryPanel">Library</button>
                <button type="button" class="workspace-tab" data-panel="tasksPanel">Scheduled tasks</button>
                <button type="button" class="workspace-tab" data-panel="codingPanel">Coding</button>
            </nav>

            <div class="workspace-content">
                <section class="workspace-panel" id="libraryPanel">
                    <h3>Save something useful</h3>
                    <p class="workspace-muted">Save notes, answers, ideas or study material in this browser.</p>
                    <form id="libraryForm" class="workspace-form">
                        <label for="libraryTitle">Title</label>
                        <input id="libraryTitle" maxlength="100" placeholder="e.g. Algebra identities" required>
                        <label for="libraryBody">Content</label>
                        <textarea id="libraryBody" rows="5" maxlength="20000" placeholder="Write or paste your notes here..." required></textarea>
                        <button class="workspace-primary" type="submit">Save to Library</button>
                    </form>
                    <div id="libraryItems" class="workspace-items"></div>
                </section>

                <section class="workspace-panel hidden" id="tasksPanel">
                    <h3>Plan a task</h3>
                    <p class="workspace-muted">Tasks are stored locally. Reminders can appear while this page remains open; this is not a cloud scheduler.</p>
                    <form id="taskForm" class="workspace-form">
                        <label for="taskTitle">Task name</label>
                        <input id="taskTitle" maxlength="160" placeholder="e.g. Revise Science chapter" required>
                        <label for="taskDue">Date and time</label>
                        <input id="taskDue" type="datetime-local" required>
                        <button class="workspace-primary" type="submit">Add scheduled task</button>
                    </form>
                    <div id="taskItems" class="workspace-items"></div>
                </section>

                <section class="workspace-panel hidden" id="codingPanel">
                    <h3>Quick coding workspace</h3>
                    <p class="workspace-muted">Write code, save snippets in this browser, or copy your code. This is not a connected Codex agent.</p>
                    <label for="codeTitle">Snippet name</label>
                    <input id="codeTitle" maxlength="100" placeholder="e.g. Python hello world">
                    <label for="codeEditor">Code editor</label>
                    <textarea id="codeEditor" class="workspace-code" rows="10" spellcheck="false" placeholder="Write your code here..."></textarea>
                    <div class="workspace-buttons">
                        <button class="workspace-primary" type="button" id="saveCodeBtn">Save snippet</button>
                        <button class="workspace-secondary" type="button" id="copyCodeBtn">Copy code</button>
                        <button class="workspace-secondary" type="button" id="downloadCodeBtn">Download .txt</button>
                    </div>
                    <div id="codeItems" class="workspace-items"></div>
                </section>
            </div>
            <p class="workspace-footnote">Your saved workspace data stays in this browser and is not synced across devices.</p>
        </section>
    </div>
"""

new_js = r'''
/* LOCAL WORKSPACE: Library, tasks and coding snippets */
const LIBRARY_KEY = "navai_library_v1";
const TASKS_KEY = "navai_scheduled_tasks_v1";
const SNIPPETS_KEY = "navai_code_snippets_v1";

function readWorkspace(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function writeWorkspace(key, items) {
    try {
        localStorage.setItem(key, JSON.stringify(items));
        return true;
    } catch {
        showToast("Browser storage is full. Remove some saved items.");
        return false;
    }
}

function safeText(tag, className, value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = String(value ? "");
    return el;
}

const workspace = $("navaiWorkspace");
const workspaceTitle = $("workspaceTitle");

function openWorkspace(panel) {
    workspace.classList.remove("hidden");
    document.body.classList.add("workspace-open");
    selectWorkspacePanel(panel || "libraryPanel");
    renderLibrary();
    renderTasks();
    renderSnippets();
    $("workspaceClose").focus();
}

function closeWorkspace() {
    workspace.classList.add("hidden");
    document.body.classList.remove("workspace-open");
}

function selectWorkspacePanel(id) {
    document.querySelectorAll(".workspace-panel").forEach(panel => {
        panel.classList.toggle("hidden", panel.id !== id);
    });
    document.querySelectorAll(".workspace-tab").forEach(tab => {
        const active = tab.dataset.panel === id;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
    });
    const titles = {
        libraryPanel: "Library",
        tasksPanel: "Scheduled tasks",
        codingPanel: "Coding workspace"
    };
    workspaceTitle.textContent = titles[id] || "Your workspace";
}

$("libraryBtn").addEventListener("click", () => openWorkspace("libraryPanel"));
$("tasksBtn").addEventListener("click", () => openWorkspace("tasksPanel"));
$("codingBtn").addEventListener("click", () => openWorkspace("codingPanel"));
$("workspaceClose").addEventListener("click", closeWorkspace);
workspace.addEventListener("click", event => {
    if (event.target === workspace) closeWorkspace();
});
document.querySelectorAll(".workspace-tab").forEach(tab => {
    tab.addEventListener("click", () => selectWorkspacePanel(tab.dataset.panel));
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !workspace.classList.contains("hidden")) closeWorkspace();
});

/* Library */
function renderLibrary() {
    const host = $("libraryItems");
    host.replaceChildren();
    const items = readWorkspace(LIBRARY_KEY).sort((a, b) => b.createdAt - a.createdAt);
    if (!items.length) {
        host.appendChild(safeText("p", "workspace-empty", "Your saved notes will appear here."));
        return;
    }
    items.forEach(item => {
        const card = safeText("article", "workspace-item");
        card.appendChild(safeText("h4", "", item.title));
        const body = safeText("p", "workspace-item-body", item.body);
        card.appendChild(body);
        const actions = safeText("div", "workspace-buttons");
        const copy = safeText("button", "workspace-secondary", "Copy");
        copy.type = "button";
        copy.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(item.body);
                showToast("Library content copied.");
            } catch {
                showToast("Copy was blocked by the browser.");
            }
        });
        const remove = safeText("button", "workspace-danger", "Delete");
        remove.type = "button";
        remove.addEventListener("click", () => {
            if (!confirm("Delete this saved item?")) return;
            writeWorkspace(LIBRARY_KEY, readWorkspace(LIBRARY_KEY).filter(x => x.id !== item.id));
            renderLibrary();
        });
        actions.append(copy, remove);
        card.appendChild(actions);
        host.appendChild(card);
    });
}

$("libraryForm").addEventListener("submit", event => {
    event.preventDefault();
    const title = $("libraryTitle").value.trim();
    const body = $("libraryBody").value.trim();
    if (!title || !body) return;
    const items = readWorkspace(LIBRARY_KEY);
    items.push({ id: makeId(), title, body, createdAt: Date.now() });
    if (!writeWorkspace(LIBRARY_KEY, items)) return;
    $("libraryTitle").value = "";
    $("libraryBody").value = "";
    renderLibrary();
    showToast("Saved to Library.");
});

/* Scheduled tasks */
function renderTasks() {
    const host = $("taskItems");
    host.replaceChildren();
    const items = readWorkspace(TASKS_KEY).sort((a, b) => a.dueAt - b.dueAt);
    if (!items.length) {
        host.appendChild(safeText("p", "workspace-empty", "No scheduled tasks yet."));
        return;
    }
    items.forEach(task => {
        const card = safeText("article", "workspace-item");
        card.appendChild(safeText("h4", "", task.title));
        const date = new Date(task.dueAt);
        card.appendChild(safeText("p", "workspace-muted",
            (task.done ? "Completed · " : "Due · ") + date.toLocaleString()));
        const actions = safeText("div", "workspace-buttons");
        if (!task.done) {
            const done = safeText("button", "workspace-secondary", "Mark complete");
            done.type = "button";
            done.addEventListener("click", () => {
                const updated = readWorkspace(TASKS_KEY).map(x =>
                    x.id === task.id ? { ...x, done: true } : x);
                writeWorkspace(TASKS_KEY, updated);
                renderTasks();
            });
            actions.appendChild(done);
        }
        const remove = safeText("button", "workspace-danger", "Delete");
        remove.type = "button";
        remove.addEventListener("click", () => {
            writeWorkspace(TASKS_KEY, readWorkspace(TASKS_KEY).filter(x => x.id !== task.id));
            renderTasks();
        });
        actions.appendChild(remove);
        card.appendChild(actions);
        host.appendChild(card);
    });
}

$("taskForm").addEventListener("submit", event => {
    event.preventDefault();
    const title = $("taskTitle").value.trim();
    const dueAt = new Date($("taskDue").value).getTime();
    if (!title || !Number.isFinite(dueAt)) {
        showToast("Enter a valid task date and time.");
        return;
    }
    const items = readWorkspace(TASKS_KEY);
    items.push({ id: makeId(), title, dueAt, done: false, reminded: false });
    if (!writeWorkspace(TASKS_KEY, items)) return;
    $("taskTitle").value = "";
    $("taskDue").value = "";
    renderTasks();
    showToast("Task scheduled in this browser.");
}

function checkWorkspaceReminders() {
    const now = Date.now();
    let changed = false;
    const items = readWorkspace(TASKS_KEY).map(task => {
        if (!task.done && !task.reminded && task.dueAt <= now) {
            task.reminded = true;
            changed = true;
            showToast("Task due: " + task.title);
            return task;
        }
        return task;
    });
    if (changed) writeWorkspace(TASKS_KEY, items);
}
setInterval(checkWorkspaceReminders, 30000);

/* Coding snippets */
function renderSnippets() {
    const host = $("codeItems");
    host.replaceChildren();
    const items = readWorkspace(SNIPPETS_KEY).sort((a, b) => b.createdAt - a.createdAt);
    if (!items.length) {
        host.appendChild(safeText("p", "workspace-empty", "Your saved snippets will appear here."));
        return;
    }
    items.forEach(item => {
        const card = safeText("article", "workspace-item");
        card.appendChild(safeText("h4", "", item.title));
        card.appendChild(safeText("p", "workspace-muted", item.code.length + " characters"));
        const actions = safeText("div", "workspace-buttons");
        const load = safeText("button", "workspace-secondary", "Open in editor");
        load.type = "button";
        load.addEventListener("click", () => {
            $("codeTitle").value = item.title;
            $("codeEditor").value = item.code;
            $("codeEditor").focus();
        });
        const remove = safeText("button", "workspace-danger", "Delete");
        remove.type = "button";
        remove.addEventListener("click", () => {
            writeWorkspace(SNIPPETS_KEY, readWorkspace(SNIPPETS_KEY).filter(x => x.id !== item.id));
            renderSnippets();
        });
        actions.append(load, remove);
        card.appendChild(actions);
        host.appendChild(card);
    });
}

$("saveCodeBtn").addEventListener("click", () => {
    const code = $("codeEditor").value;
    const title = $("codeTitle").value.trim() || "Untitled snippet";
    if (!code.trim()) {
        showToast("Write some code first.");
        return;
    }
    const items = readWorkspace(SNIPPETS_KEY);
    items.push({ id: makeId(), title, code, createdAt: Date.now() });
    if (!writeWorkspace(SNIPPETS_KEY, items)) return;
    renderSnippets();
    showToast("Code snippet saved.");
});

$("copyCodeBtn").addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText($("codeEditor").value);
        showToast("Code copied.");
    } catch {
        showToast("Clipboard access was blocked. Try HTTPS or localhost.");
    }
});

$("downloadCodeBtn").addEventListener("click", () => {
    const content = $("codeEditor").value;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = (($("codeTitle").value.trim() || "navai-code")
        .replace(/[^a-z0-9_-]/gi, "_").slice(0, 70)) + ".txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Code file downloaded.");
});

/* Keep chat deletion controls visible and easy to tap on touch screens. */
'''

new_css = r'''

/* NavAI workspace panels */
.workspace-nav {
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid var(--border);
}
.workspace-nav-heading {
    margin: 0 9px 8px;
    color: var(--muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.25px;
}
.workspace-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(3, 5, 12, .72);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}
.workspace-window {
    display: flex;
    flex-direction: column;
    width: min(760px, 100%);
    max-height: min(850px, 92dvh);
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 20px;
    background: var(--panel);
    color: var(--text);
    box-shadow: 0 24px 90px rgba(0,0,0,.42);
}
.workspace-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 22px 24px 16px;
    border-bottom: 1px solid var(--border);
}
.workspace-kicker {
    color: var(--blue-bright);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.6px;
}
.workspace-header h2 {
    margin: 5px 0 0;
    font-family: "Space Grotesk", sans-serif;
    font-size: 23px;
}
.workspace-close {
    width: 38px;
    height: 38px;
    border: 1px solid var(--border);
    border-radius: 11px;
    background: var(--panel-hover);
    color: var(--text);
    font-size: 22px;
}
.workspace-tabs {
    display: flex;
    gap: 7px;
    padding: 12px 22px;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
}
.workspace-tab {
    flex-shrink: 0;
    padding: 10px 13px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: var(--muted);
}
.workspace-tab.active {
    border-color: rgba(101,136,255,.35);
    background: var(--blue-soft);
    color: var(--text);
}
.workspace-content {
    padding: 22px 24px;
    overflow-y: auto;
    min-height: 0;
}
.workspace-panel h3 {
    margin: 0 0 8px;
    font-size: 17px;
}
.workspace-muted, .workspace-footnote {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.65;
}
.workspace-form {
    display: flex;
    flex-direction: column;
    gap: 9px;
    margin: 18px 0;
}
.workspace-panel label {
    margin-top: 5px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
}
.workspace-panel input,
.workspace-panel textarea {
    width: 100%;
    min-width: 0;
    padding: 12px 13px;
    border: 1px solid var(--border);
    border-radius: 11px;
    outline: none;
    background: var(--bg);
    color: var(--text);
    line-height: 1.55;
}
.workspace-panel input:focus,
.workspace-panel textarea:focus {
    border-color: var(--blue);
    box-shadow: 0 0 0 3px var(--blue-soft);
}
.workspace-panel textarea {
    resize: vertical;
}
.workspace-code {
    margin-top: 8px;
    font-family: Consolas, "Courier New", monospace;
    font-size: 13px;
    tab-size: 4;
}
.workspace-primary, .workspace-secondary, .workspace-danger {
    min-height: 38px;
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--panel-hover);
    color: var(--text);
    font-size: 12px;
    font-weight: 600;
}
.workspace-primary {
    border-color: rgba(101,136,255,.4);
    background: linear-gradient(110deg, #4568e8, #627ff2);
    color: white;
}
.workspace-danger {
    color: #ff9999;
}
.workspace-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
}
.workspace-items {
    display: grid;
    gap: 10px;
    margin-top: 18px;
}
.workspace-item {
    min-width: 0;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 13px;
    background: var(--bg);
}
.workspace-item h4 {
    margin: 0 0 7px;
    overflow-wrap: anywhere;
}
.workspace-item-body {
    max-height: 180px;
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.65;
}
.workspace-empty {
    padding: 18px 5px;
    color: var(--muted);
    font-size: 13px;
}
.workspace-footnote {
    margin: 0;
    padding: 12px 24px;
    border-top: 1px solid var(--border);
}
body.workspace-open {
    overflow: hidden;
}
.delete-chat-button {
    opacity: 1;
}
.history-item {
    min-height: 42px;
}
.history-open-button {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    gap: 7px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
}
@media (max-width: 650px) {
    .workspace-backdrop {
        padding: 8px;
        align-items: end;
    }
    .workspace-window {
        width: 100%;
        max-height: 94dvh;
        border-radius: 18px 18px 12px 12px;
    }
    .workspace-header {
        padding: 17px 16px 13px;
    }
    .workspace-header h2 {
        font-size: 20px;
    }
    .workspace-tabs {
        padding: 10px 12px;
    }
    .workspace-content {
        padding: 17px 15px;
    }
    .workspace-footnote {
        padding: 10px 15px;
    }
    .workspace-nav {
        margin-top: 12px;
    }
    .workspace-buttons > button {
        min-height: 42px;
    }
    .delete-chat-button {
        min-width: 34px;
        min-height: 34px;
    }
}
'''

html = html.replace(sidebar_anchor, sidebar + sidebar_anchor, 1)
html = html.replace(modal_anchor, modal + "\n" + modal_anchor, 1)
js = js.replace(theme_anchor, new_js + "\n" + theme_anchor, 1)
css += "\n" + new_css

# Write only after all insertion anchors have been validated.
(root / "index.html").write_text(html, encoding="utf-8")
(root / "script.js").write_text(js, encoding="utf-8")
(root / "style.css").write_text(css, encoding="utf-8")

print("Workspace update applied.")
print("Backup:", backup)

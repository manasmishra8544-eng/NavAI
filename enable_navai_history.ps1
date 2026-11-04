# NavAI history installer
# Run from the NavAI-Git project folder. Creates backups before modifying files.
$ErrorActionPreference = "Stop"

$required = @("website-developer.js", "website-developer.html", "classroom.js", "classroom.html")
foreach ($file in $required) {
    if (-not (Test-Path -LiteralPath $file)) {
        throw "Missing $file. Open PowerShell in your NavAI-Git folder and run this script again."
    }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
foreach ($file in $required) {
    Copy-Item -LiteralPath $file -Destination "$file.history-backup-$stamp" -Force
}
Write-Host "Backups created with suffix: history-backup-$stamp" -ForegroundColor Green

# Website Builder: allow a saved project to be restored into the existing editor state.
$builderJsPath = (Resolve-Path ".\website-developer.js").Path
$builderJs = [System.IO.File]::ReadAllText($builderJsPath)
$builderAnchor = '  generate.addEventListener("click", generateWebsite);'
$builderRestore = @'
  window.addEventListener("navai:restore-website", event => {
    const saved = event.detail || {};
    if (typeof saved.html !== "string" || !saved.html.toLowerCase().includes("<html")) return;
    currentHTML = saved.html;
    prompt.value = saved.prompt || "";
    preview.srcdoc = currentHTML;
    showPreview();
    showGeneratedWebsite();
    download.disabled = false;
    message("Saved website restored. You can preview, download, or continue editing it.", "success");
  });

  generate.addEventListener("click", generateWebsite);
'@
if (-not $builderJs.Contains($builderAnchor)) {
    throw "Could not find the expected Website Builder insertion point. Backups are safe; no further files were changed."
}
$builderJs = $builderJs.Replace($builderAnchor, $builderRestore.TrimEnd())
[System.IO.File]::WriteAllText($builderJsPath, $builderJs, [System.Text.UTF8Encoding]::new($false))

# Website Builder history UI and persistence.
$builderHistoryJs = @'
(() => {
  "use strict";
  const KEY = "navai.websiteBuilder.history.v1";
  const $ = id => document.getElementById(id);
  const read = () => {
    try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; }
    catch { return []; }
  };
  const write = items => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); return true; }
    catch { alert("History could not be saved. Browser storage may be full."); return false; }
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const panel = document.createElement("section");
  panel.id = "navai-builder-history";
  panel.innerHTML = `
    <style>
      #navai-builder-history{margin:18px 0;padding:18px;border:1px solid #263b60;border-radius:16px;background:rgba(10,20,42,.92);color:#eaf0ff}
      #navai-builder-history .nbh-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      #navai-builder-history h3{margin:0;font-size:16px} #navai-builder-history p{margin:6px 0 0;color:#9eafd0;font-size:12px}
      #navai-builder-history button{cursor:pointer;border:1px solid #354d78;border-radius:9px;padding:8px 11px;background:#142746;color:#eaf0ff}
      #navai-builder-history .nbh-list{display:grid;gap:8px;margin-top:14px}
      #navai-builder-history .nbh-item{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px;border:1px solid #22385b;border-radius:11px}
      #navai-builder-history .nbh-title{font-size:13px;overflow-wrap:anywhere} #navai-builder-history .nbh-date{font-size:11px;color:#9eafd0;margin-top:4px}
      #navai-builder-history .nbh-actions{display:flex;gap:7px;flex-shrink:0}
      #navai-builder-history .nbh-empty{color:#9eafd0;font-size:13px;padding:12px 0}
      @media(max-width:560px){#navai-builder-history .nbh-item{align-items:flex-start;flex-direction:column}#navai-builder-history .nbh-actions{flex-wrap:wrap}}
    </style>
    <div class="nbh-head"><div><h3>Saved website projects</h3><p>Projects are saved automatically in this browser.</p></div><button type="button" id="nbh-clear">Clear history</button></div>
    <div class="nbh-list" id="nbh-list"></div>`;
  const host = document.querySelector(".editor") || document.querySelector("main") || document.body;
  host.appendChild(panel);
  const list = $("nbh-list");
  function render() {
    const items = read().sort((a,b) => b.updatedAt - a.updatedAt);
    if (!items.length) { list.innerHTML = '<div class="nbh-empty">No saved projects yet. Generate a website and it will appear here.</div>'; return; }
    list.innerHTML = items.map(item => `
      <div class="nbh-item">
        <div><div class="nbh-title">${esc(item.prompt || "Untitled website")}</div><div class="nbh-date">${esc(new Date(item.updatedAt).toLocaleString())}</div></div>
        <div class="nbh-actions"><button type="button" data-open="${esc(item.id)}">Open</button><button type="button" data-delete="${esc(item.id)}">Delete</button></div>
      </div>`).join("");
  }
  function save(prompt, html) {
    const items = read();
    items.push({id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, prompt, html, updatedAt: Date.now()});
    write(items);
    render();
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const response = await originalFetch(input, init);
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (url.includes("/api/website-builder") && response.ok) {
      try {
        const req = JSON.parse((init && init.body) || "{}");
        const data = await response.clone().json();
        if (typeof data.html === "string" && data.html.toLowerCase().includes("<html")) save(req.prompt || "Website project", data.html);
      } catch (e) { console.warn("NavAI Builder history save failed", e); }
    }
    return response;
  };
  list.addEventListener("click", event => {
    const openButton = event.target.closest("[data-open]");
    const deleteButton = event.target.closest("[data-delete]");
    if (openButton) {
      const item = read().find(x => x.id === openButton.dataset.open);
      if (item) {
        window.dispatchEvent(new CustomEvent("navai:restore-website", {detail:{html:item.html,prompt:item.prompt}}));
        window.scrollTo({top:0,behavior:"smooth"});
      }
    }
    if (deleteButton) {
      if (!confirm("Delete this saved website project?")) return;
      write(read().filter(x => x.id !== deleteButton.dataset.delete));
      render();
    }
  });
  $("nbh-clear").addEventListener("click", () => {
    if (!read().length) return;
    if (confirm("Delete all saved Website Builder history? This cannot be undone.")) { write([]); render(); }
  });
  render();
})();
'@
[System.IO.File]::WriteAllText((Join-Path (Get-Location) "website-builder-history.js"), $builderHistoryJs, [System.Text.UTF8Encoding]::new($false))

# Attach the history script to the builder page.
$builderHtmlPath = (Resolve-Path ".\website-developer.html").Path
$builderHtml = [System.IO.File]::ReadAllText($builderHtmlPath)
if (-not $builderHtml.Contains("website-builder-history.js")) {
    if (-not $builderHtml.Contains("</body>")) { throw "Could not find </body> in website-developer.html." }
    $builderHtml = $builderHtml.Replace("</body>", ' <script src="/website-builder-history.js"></script>' + "`r`n</body>")
    [System.IO.File]::WriteAllText($builderHtmlPath, $builderHtml, [System.Text.UTF8Encoding]::new($false))
}

# Teacher: add durable lesson history in the same script scope, so it can restore lesson/progress safely.
$teacherJsPath = (Resolve-Path ".\classroom.js").Path
$teacherJs = [System.IO.File]::ReadAllText($teacherJsPath)
if (-not $teacherJs.Contains("NAVAI_TEACHER_HISTORY_V1")) {
$teacherAppend = @'

// NAVAI_TEACHER_HISTORY_V1
(() => {
  const KEY = "navai.teacher.history.v1";
  let currentSavedLessonId = null;
  const readSaved = () => {
    try { const value = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(value) ? value : []; }
    catch { return []; }
  };
  const writeSaved = items => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); return true; }
    catch { setStatus("History could not be saved. Browser storage may be full.", "error"); return false; }
  };
  const escSaved = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const historyPanel = document.createElement("section");
  historyPanel.id = "navai-teacher-history";
  historyPanel.innerHTML = `
    <style>
      #navai-teacher-history{margin:18px 0;padding:18px;border:1px solid rgba(145,170,255,.22);border-radius:18px;background:rgba(9,17,35,.9);color:#eaf0ff}
      #navai-teacher-history .nth-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
      #navai-teacher-history h2{font-size:18px;margin:0} #navai-teacher-history p{font-size:12px;color:#aab9d7;margin:6px 0 0}
      #navai-teacher-history button{border:1px solid rgba(145,170,255,.3);border-radius:10px;background:#152544;color:#eaf0ff;padding:9px 12px;cursor:pointer}
      #navai-teacher-history .nth-list{display:grid;gap:8px;margin-top:14px}
      #navai-teacher-history .nth-item{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid rgba(145,170,255,.16);border-radius:12px;padding:11px}
      #navai-teacher-history .nth-title{font-size:13px;overflow-wrap:anywhere} #navai-teacher-history .nth-date{font-size:11px;color:#aab9d7;margin-top:4px}
      #navai-teacher-history .nth-actions{display:flex;gap:7px;flex-shrink:0}
      #navai-teacher-history .nth-empty{font-size:13px;color:#aab9d7;padding:12px 0}
      @media(max-width:560px){#navai-teacher-history .nth-item{align-items:flex-start;flex-direction:column}#navai-teacher-history .nth-actions{flex-wrap:wrap}}
    </style>
    <div class="nth-head"><div><h2>Lesson history</h2><p>Lessons and your current step are saved automatically in this browser.</p></div><button type="button" id="nth-clear">Clear history</button></div>
    <div class="nth-list" id="nth-list"></div>`;
  const host = document.querySelector(".layout") || document.body;
  const boardSection = document.querySelector(".board-section");
  if (boardSection) host.insertBefore(historyPanel, boardSection);
  else host.appendChild(historyPanel);
  const list = document.getElementById("nth-list");

  function renderSavedList() {
    const items = readSaved().sort((a,b) => b.updatedAt - a.updatedAt);
    if (!items.length) { list.innerHTML = '<div class="nth-empty">No lessons saved yet. Ask Pico to teach a topic.</div>'; return; }
    list.innerHTML = items.map(item => `
      <div class="nth-item">
        <div><div class="nth-title">${escSaved(item.title || item.question || "Untitled lesson")}</div><div class="nth-date">${escSaved(new Date(item.updatedAt).toLocaleString())} · Step ${(Number(item.activeStep)||0)+1}</div></div>
        <div class="nth-actions"><button type="button" data-nth-open="${escSaved(item.id)}">Open</button><button type="button" data-nth-delete="${escSaved(item.id)}">Delete</button></div>
      </div>`).join("");
  }
  function saveCurrentLesson(question, raw, isFollowup) {
    if (!lesson) return;
    const items = readSaved();
    let item = isFollowup && currentSavedLessonId ? items.find(x => x.id === currentSavedLessonId) : null;
    if (!item) {
      item = {id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, question, title: lesson.title || question, createdAt: Date.now()};
      items.push(item);
      currentSavedLessonId = item.id;
    }
    item.question = item.question || question;
    item.title = lesson.title || item.question;
    item.lesson = lesson;
    item.chatHistory = history;
    item.activeStep = activeStep;
    item.updatedAt = Date.now();
    writeSaved(items);
    renderSavedList();
  }
  function saveStep() {
    if (!currentSavedLessonId || !lesson) return;
    const items = readSaved();
    const item = items.find(x => x.id === currentSavedLessonId);
    if (!item) return;
    item.lesson = lesson;
    item.chatHistory = history;
    item.activeStep = activeStep;
    item.updatedAt = Date.now();
    writeSaved(items);
    renderSavedList();
  }
  list.addEventListener("click", event => {
    const openButton = event.target.closest("[data-nth-open]");
    const deleteButton = event.target.closest("[data-nth-delete]");
    if (openButton) {
      const item = readSaved().find(x => x.id === openButton.dataset.nthOpen);
      if (!item || !item.lesson) return;
      stopVoice();
      currentSavedLessonId = item.id;
      lesson = item.lesson;
      activeStep = Math.max(0, Math.min(Number(item.activeStep) || 0, lesson.steps.length - 1));
      history = Array.isArray(item.chatHistory) ? item.chatHistory : [];
      topicInput.value = item.question || item.title || "";
      renderLesson();
      setStatus("Saved lesson restored. Continue from where you left off.", "success");
      document.querySelector(".board-section")?.scrollIntoView({behavior:"smooth",block:"start"});
    }
    if (deleteButton) {
      if (!confirm("Delete this saved lesson?")) return;
      if (currentSavedLessonId === deleteButton.dataset.nthDelete) currentSavedLessonId = null;
      writeSaved(readSaved().filter(x => x.id !== deleteButton.dataset.nthDelete));
      renderSavedList();
    }
  });
  document.getElementById("nth-clear").addEventListener("click", () => {
    if (!readSaved().length) return;
    if (confirm("Delete all NavAI Teacher lesson history? This cannot be undone.")) {
      writeSaved([]);
      currentSavedLessonId = null;
      renderSavedList();
    }
  });

  // Hook into the existing lesson flow without changing the AI request/response.
  const originalTeach = teach;
  teach = async function(question, isFollowup = false) {
    const previousId = currentSavedLessonId;
    const previousLesson = lesson;
    await originalTeach(question, isFollowup);
    if (lesson && lesson !== previousLesson) {
      // A new topic creates a new saved lesson; follow-ups update that lesson.
      if (!isFollowup) currentSavedLessonId = null;
      saveCurrentLesson(question, "", isFollowup);
    } else {
      currentSavedLessonId = previousId;
    }
  };

  // Existing step handlers run first; these listeners persist the updated step afterward.
  document.getElementById("prevBtn")?.addEventListener("click", saveStep);
  document.getElementById("nextBtn")?.addEventListener("click", saveStep);

  renderSavedList();
})();
'@
    $teacherJs += $teacherAppend
    [System.IO.File]::WriteAllText($teacherJsPath, $teacherJs, [System.Text.UTF8Encoding]::new($false))
}

Write-Host "`nHistory code installed in local files." -ForegroundColor Green
Write-Host "Website Builder history: website-builder-history.js"
Write-Host "Teacher history: classroom.js"
Write-Host "Next: test both pages locally, then deploy the changed files." -ForegroundColor Yellow
Write-Host "Note: localStorage persists in this browser/origin; clearing browser site data can remove it."

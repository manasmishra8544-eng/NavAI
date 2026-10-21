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
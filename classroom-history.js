(() => {
  "use strict";
  const KEY = "navai.teacher.history.v1";
  const read = () => {
    try {
      const items = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(items) ? items : [];
    } catch { return []; }
  };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])
  );

  const panel = document.createElement("section");
  panel.id = "navai-teacher-history";
  panel.innerHTML = `
    <style>
      #navai-teacher-history{margin:20px 0;padding:16px;border:1px solid #263b60;border-radius:14px;background:#0b1530;color:#eaf0ff}
      #navai-teacher-history .nth-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
      #navai-teacher-history h3{margin:0;font-size:16px}
      #navai-teacher-history p{color:#9eafd0;font-size:12px}
      #navai-teacher-history button{cursor:pointer;border:1px solid #354d78;border-radius:8px;padding:8px 10px;background:#142746;color:#eaf0ff}
      #navai-teacher-history .nth-list{display:grid;gap:8px;margin-top:12px}
      #navai-teacher-history .nth-item{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:10px;border:1px solid #22385b;border-radius:10px}
      #navai-teacher-history .nth-actions{display:flex;gap:6px;flex-wrap:wrap}
      #navai-teacher-history .nth-empty{color:#9eafd0;font-size:13px;padding:8px 0}
    </style>
    <div class="nth-head">
      <div><h3>Saved Lessons</h3><p>Your lessons stay saved in this browser.</p></div>
      <button type="button" data-clear>Clear history</button>
    </div>
    <div class="nth-list"></div>`;

  const form = document.getElementById("lessonForm");
  if (form) form.insertAdjacentElement("afterend", panel);
  else (document.querySelector("main") || document.body).appendChild(panel);

  const list = panel.querySelector(".nth-list");

  function render() {
    const items = read().sort((a, b) => b.updatedAt - a.updatedAt);
    if (!items.length) {
      list.innerHTML = '<div class="nth-empty">No saved lessons yet. Generate a lesson first.</div>';
      return;
    }
    list.innerHTML = items.map(item => `
      <div class="nth-item">
        <div>
          <div>${esc(item.question || "Saved lesson")}</div>
          <small>${esc(item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "")}</small>
        </div>
        <div class="nth-actions">
          <button type="button" data-open="${esc(item.id)}">Open lesson</button>
          <button type="button" data-delete="${esc(item.id)}">Delete</button>
        </div>
      </div>`).join("");
  }

  panel.addEventListener("click", event => {
    const open = event.target.closest("[data-open]");
    const del = event.target.closest("[data-delete]");
    if (open) {
      const item = read().find(x => x.id === open.dataset.open);
      if (item) window.dispatchEvent(new CustomEvent("navai:restore-lesson", {detail: item}));
    }
    if (del) {
      if (!confirm("Delete this saved lesson?")) return;
      localStorage.setItem(KEY, JSON.stringify(read().filter(x => x.id !== del.dataset.delete)));
      render();
    }
    if (event.target.closest("[data-clear]")) {
      if (!read().length || !confirm("Delete all saved lessons?")) return;
      localStorage.removeItem(KEY);
      render();
    }
  });

  window.addEventListener("navai:teacher-history-updated", render);
  render();
})();
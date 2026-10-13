(() => {
  function initNavAISidebar() {
    const sidebar = document.querySelector("#sidebar");
    const history = document.querySelector("#chatHistory");
    if (!sidebar || !history || sidebar.dataset.premiumNav === "1") return;
    sidebar.dataset.premiumNav = "1";

    const css = document.createElement("style");
    css.textContent = `
      .navai-reference-nav { display:flex; flex-direction:column; gap:5px; margin:14px 0 20px; }
      .navai-search-wrap { position:relative; margin-bottom:5px; }
      .navai-search-wrap input {
        width:100%; box-sizing:border-box; height:43px; padding:0 38px 0 42px;
        border:1px solid var(--border); border-radius:12px;
        background:var(--panel); color:var(--text); font:inherit; outline:none;
      }
      .navai-search-wrap input:focus { border-color:var(--accent, #647eea); }
      .navai-search-symbol { position:absolute; left:14px; top:11px; opacity:.75; pointer-events:none; }
      .navai-search-shortcut { position:absolute; right:11px; top:10px; opacity:.7; font-size:12px; }
      .navai-reference-item {
        display:flex; align-items:center; gap:13px; width:100%; min-height:43px;
        padding:0 13px; box-sizing:border-box; border:1px solid transparent;
        border-radius:11px; background:transparent; color:var(--muted);
        text-align:left; font:inherit; cursor:pointer; transition:background .15s ease,color .15s ease;
      }
      .navai-reference-item:hover,.navai-reference-item.selected {
        background:var(--panel-hover); color:var(--text);
      }
      .navai-reference-item .nav-icon { width:19px; text-align:center; font-size:18px; flex-shrink:0; }
      .navai-today-label { margin:9px 9px 7px; color:var(--muted); font-size:13px; }
      .navai-sidebar-notice { padding:9px 10px; font-size:12px; color:var(--muted); line-height:1.5; }
      #chatHistory .history-item { border-radius:10px; margin:3px 0; }
      #chatHistory .history-item-title { white-space:nowrap; }
      @media(max-width:700px) {
        .navai-reference-nav { margin-top:10px; }
        .navai-reference-item { min-height:44px; }
      }
    `;
    document.head.appendChild(css);

    const nav = document.createElement("div");
    nav.className = "navai-reference-nav";
    nav.innerHTML = `
      <label class="navai-search-wrap">
        <span class="navai-search-symbol">⌕</span>
        <input id="navaiSidebarSearch" type="search" placeholder="Search" aria-label="Search conversations">
        <span class="navai-search-shortcut">/</span>
      </label>
      <button type="button" class="navai-reference-item" data-nav="home"><span class="nav-icon">⌂</span>Home</button>
      <button type="button" class="navai-reference-item" data-nav="explore"><span class="nav-icon">◎</span>Explore</button>
      <button type="button" class="navai-reference-item" data-nav="library"><span class="nav-icon">▱</span>Library</button>
      <button type="button" class="navai-reference-item" data-nav="history"><span class="nav-icon">◷</span>History</button>
      <button type="button" class="navai-reference-item" data-nav="interrogations"><span class="nav-icon">⚿</span>Interrogations</button>
    `;

    const firstSection = sidebar.querySelector(".sidebar-section");
    if (firstSection) sidebar.insertBefore(nav, firstSection);
    else sidebar.insertBefore(nav, history);

    const heading = firstSection?.querySelector(".section-heading");
    if (heading) {
      const label = heading.querySelector("span");
      if (label) label.textContent = "TODAY";
    }

    const search = nav.querySelector("#navaiSidebarSearch");
    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      history.querySelectorAll(".history-item").forEach(item => {
        item.style.display = item.innerText.toLowerCase().includes(query) ? "" : "none";
      });
    });

    nav.addEventListener("click", event => {
      const button = event.target.closest("[data-nav]");
      if (!button) return;
      const action = button.dataset.nav;
      nav.querySelectorAll("[data-nav]").forEach(item => item.classList.toggle("selected", item === button));

      if (action === "home") {
        document.querySelector("#homeBtn")?.click();
      } else if (action === "history") {
        history.scrollIntoView({ behavior:"smooth", block:"start" });
      } else if (action === "explore") {
        showNotice("Explore", "Explore navigation is ready for your future NavAI tools.");
      } else if (action === "library") {
        showNotice("Library", "Your saved conversations remain in chat history. A separate file library needs storage integration.");
      } else if (action === "interrogations") {
        showNotice("Interrogations", "This section can host practice questions and quizzes.");
      }
    });

    function showNotice(title, message) {
      let box = sidebar.querySelector("#navai-sidebar-notice");
      if (!box) {
        box = document.createElement("div");
        box.id = "navai-sidebar-notice";
        box.className = "navai-sidebar-notice";
        nav.appendChild(box);
      }
      box.textContent = title + " — " + message;
    }

    document.addEventListener("keydown", event => {
      if (event.key === "/" && !["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) {
        event.preventDefault();
        search.focus();
      }
      if (event.key === "Escape" && document.activeElement === search) {
        search.value = "";
        search.dispatchEvent(new Event("input"));
        search.blur();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNavAISidebar, { once:true });
  } else {
    initNavAISidebar();
  }
})();

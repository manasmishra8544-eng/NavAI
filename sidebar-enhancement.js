(() => {
  function initNavAISidebar() {
    const sidebar = document.querySelector("#sidebar");
    const history = document.querySelector("#chatHistory");
    if (!sidebar || !history || sidebar.dataset.premiumNav === "1") return;
    sidebar.dataset.premiumNav = "1";

    const css = document.createElement("style");
    css.textContent = `
      .navai-reference-nav {
        display:flex; flex-direction:column; gap:5px; margin:14px 0 20px;
      }
      .navai-search-wrap { position:relative; margin-bottom:5px; }
      .navai-search-wrap input {
        width:100%; box-sizing:border-box; height:43px; padding:0 38px 0 42px;
        border:1px solid var(--border); border-radius:12px;
        background:var(--panel) !important; color:var(--text); font:inherit;
        outline:none; box-shadow:none !important; transition:none !important;
      }
      .navai-search-wrap input:hover,
      .navai-search-wrap input:focus,
      .navai-search-wrap input:active {
        background:var(--panel) !important;
        border-color:var(--border) !important;
        box-shadow:none !important; filter:none !important;
      }
      .navai-search-symbol {
        position:absolute; left:14px; top:11px; opacity:.75; pointer-events:none;
      }
      .navai-search-shortcut {
        position:absolute; right:11px; top:10px; opacity:.7; font-size:12px;
      }
      .navai-reference-item {
        display:flex; align-items:center; gap:13px; width:100%; min-height:43px;
        padding:0 13px; box-sizing:border-box; border:1px solid transparent;
        border-radius:11px; background:transparent !important;
        color:var(--muted) !important; text-align:left; font:inherit;
        cursor:pointer; box-shadow:none !important; filter:none !important;
        transform:none !important; transition:none !important;
        outline:none !important;
      }
      .navai-reference-item:hover,
      .navai-reference-item:active,
      .navai-reference-item:focus,
      .navai-reference-item:focus-visible,
      .navai-reference-item.selected {
        background:transparent !important;
        background-color:transparent !important;
        background-image:none !important;
        color:var(--muted) !important;
        border-color:transparent !important;
        box-shadow:none !important; filter:none !important;
        transform:none !important; outline:none !important;
      }
      .navai-reference-item .nav-icon {
        width:19px; height:20px; display:flex; align-items:center; justify-content:center; flex-shrink:0;
      }
      .navai-reference-item .nav-icon svg { width:19px; height:19px; display:block; }
      #sidebar { max-height:100vh; overflow-y:auto !important; overflow-x:hidden !important; min-height:0; scrollbar-gutter:stable; }
      #chatHistory { min-height:0; overflow-y:auto !important; overflow-x:hidden !important; }
      #sidebar::-webkit-scrollbar, #chatHistory::-webkit-scrollbar { width:6px; }
      #sidebar::-webkit-scrollbar-thumb, #chatHistory::-webkit-scrollbar-thumb { background:var(--border); border-radius:8px; }
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

const navLayoutRepair = document.createElement("style");
navLayoutRepair.textContent = `
  #sidebar {
    max-height: 100vh !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    min-height: 0 !important;
    overscroll-behavior-y: contain;
  }

  #sidebar .navai-reference-nav {
    display: flex !important;
    flex-direction: column !important;
    flex-shrink: 0 !important;
    gap: 5px !important;
  }

  #sidebar .navai-search-wrap {
    position: sticky !important;
    top: 0 !important;
    z-index: 20 !important;
    flex-shrink: 0 !important;
    background: transparent !important;
    padding: 5px 0 !important;
  }

  #sidebar .navai-search-wrap input,
  #sidebar .navai-search-wrap input:hover,
  #sidebar .navai-search-wrap input:focus,
  #sidebar .navai-search-wrap input:active {
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
    filter: none !important;
  }

  #sidebar .navai-reference-item,
  #sidebar .navai-reference-item:hover,
  #sidebar .navai-reference-item:active,
  #sidebar .navai-reference-item:focus,
  #sidebar .navai-reference-item.selected {
    background: transparent !important;
    background-color: transparent !important;
    color: var(--muted) !important;
    box-shadow: none !important;
    filter: none !important;
    transform: none !important;
    transition: none !important;
  }

  #sidebar #chatHistory {
    overflow: visible !important;
    max-height: none !important;
    flex-shrink: 0 !important;
  }

  #sidebar::-webkit-scrollbar {
    width: 6px;
  }

  #sidebar::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 8px;
  }
`;
document.head.appendChild(navLayoutRepair);








    const nav = document.createElement("div");
    nav.className = "navai-reference-nav";
    nav.innerHTML = `
      <label class="navai-search-wrap">
        <span class="navai-search-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15.5 15.5 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>
        <input id="navaiSidebarSearch" type="search" placeholder="Search" aria-label="Search conversations">
        <span class="navai-search-shortcut">/</span>
      </label>
<button type="button" class="navai-reference-item" data-nav="explore"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/></svg></span>Explore</button>
      <button type="button" class="navai-reference-item" data-nav="library"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h11l3 3V20H5zM16 4.5V8h3M8 12h8M8 16h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Library</button>
      <button type="button" class="navai-reference-item" data-nav="history"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>History</button>
      <button type="button" class="navai-reference-item" data-nav="interrogations"><span class="nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8.5 9h7M8.5 13h7M8.5 17h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></span>Interrogations</button>
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
      box.textContent = title + " ? " + message;
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


/* NAVAI SCROLL FIX */
const navaiScrollFix = document.createElement("style");
navaiScrollFix.textContent = `
  html, body {
    min-height: 100%;
  }

  #sidebar {
    height: 100vh !important;
    max-height: 100vh !important;
    min-height: 0 !important;
    overflow-y: scroll !important;
    overflow-x: hidden !important;
    overscroll-behavior: contain;
  }

  #sidebar .navai-reference-nav {
    display: flex !important;
    flex-direction: column !important;
    flex-shrink: 0 !important;
  }

  #sidebar .navai-search-wrap {
    position: sticky !important;
    top: 0 !important;
    z-index: 30 !important;
  }

  #sidebar .sidebar-section,
  #sidebar #chatHistory {
    flex-shrink: 0 !important;
    min-height: max-content !important;
    overflow: visible !important;
    max-height: none !important;
  }
`;
document.head.appendChild(navaiScrollFix);


/* Hide unwanted history symbols only */
const navaiHistoryIconFix = document.createElement("style");
navaiHistoryIconFix.textContent = `
  #chatHistory .history-item > :first-child {
    /* Keep existing layout unchanged */
  }
  #chatHistory .history-item .history-item-icon,
  #chatHistory .history-item .history-icon,
  #chatHistory .history-item .history-item-delete,
  #chatHistory .history-item .delete-btn {
    display: inline-flex !important;
  }
`;
document.head.appendChild(navaiHistoryIconFix);


/* Hide only the icon before the Chat history heading */
const navaiHeadingIconFix = document.createElement("style");
navaiHeadingIconFix.textContent = `
  #sidebar .section-heading > :first-child,
  #sidebar .section-heading svg,
  #sidebar .section-heading img {
    /* Preserve heading text and layout */
  }
  #sidebar .section-heading .nav-icon,
  #sidebar .section-heading .history-icon,
  #sidebar .section-heading .icon {
    display: none !important;
  }
`;
document.head.appendChild(navaiHeadingIconFix);


/* Targeted fix: hide only visibly broken encoding symbols */
const navaiBrokenSymbolFix = document.createElement("style");
navaiBrokenSymbolFix.textContent = `
  #sidebar .section-heading > .broken-icon,
  #sidebar .section-heading > .icon-broken,
  #sidebar .section-heading .encoding-icon,
  #sidebar .section-heading .history-icon {
    display: none !important;
  }

  #chatHistory .history-item .broken-icon,
  #chatHistory .history-item .encoding-icon {
    display: none !important;
  }
`;
document.head.appendChild(navaiBrokenSymbolFix);


const navaiHistoryIconFix2 = document.createElement("style");
navaiHistoryIconFix2.textContent = `
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
document.head.appendChild(navaiHistoryIconFix2);

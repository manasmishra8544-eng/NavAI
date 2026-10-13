(() => {
  function init() {
    const sidebar = document.querySelector(".sidebar");
    const newChat = document.querySelector("#newChatBtn");
    const history = document.querySelector("#chatHistory");

    if (!sidebar || !newChat || !history) {
      console.error("NavAI sidebar: required elements not found.");
      return;
    }

    document.querySelector("#navai-reference-style")?.remove();
    document.querySelector("#navai-reference-nav")?.remove();

    const style = document.createElement("style");
    style.id = "navai-reference-style";
    style.textContent = `
      #navai-reference-nav {
        display:flex; flex-direction:column; gap:5px;
        margin:12px 0 18px; width:100%; box-sizing:border-box;
      }
      #navai-reference-nav .nr-search {
        height:43px; display:flex; align-items:center; gap:10px;
        padding:0 12px; margin-bottom:5px; border:1px solid var(--border);
        border-radius:12px; background:var(--panel); box-sizing:border-box;
      }
      #navai-reference-nav .nr-search-icon { font-size:20px; opacity:.8; }
      #navai-reference-nav input {
        width:100%; min-width:0; border:0; outline:0; background:transparent;
        color:var(--text); font:inherit;
      }
      #navai-reference-nav input::placeholder { color:var(--muted); }
      #navai-reference-nav .nr-shortcut {
        padding:2px 7px; border:1px solid var(--border);
        border-radius:6px; font-size:12px; opacity:.8;
      }
      #navai-reference-nav .nr-link {
        display:flex; align-items:center; gap:13px; width:100%;
        min-height:43px; padding:0 13px; box-sizing:border-box;
        border:1px solid transparent; border-radius:11px;
        background:transparent; color:var(--muted); font:inherit;
        text-align:left; cursor:pointer; transition:background .16s,color .16s;
      }
      #navai-reference-nav .nr-link:hover,
      #navai-reference-nav .nr-link.nr-active {
        background:var(--panel); color:var(--text);
      }
      #navai-reference-nav .nr-icon {
        width:20px; text-align:center; flex-shrink:0; font-size:18px;
      }
      #navai-reference-nav .nr-label {
        margin:8px 9px 4px; color:var(--muted); font-size:12px;
        letter-spacing:.5px;
      }
      #chatHistory .history-item {
        border-radius:10px;
      }
      @media(max-width:700px) {
        #navai-reference-nav { margin-top:8px; }
        #navai-reference-nav .nr-link { min-height:44px; }
      }
    `;
    document.head.appendChild(style);

    const nav = document.createElement("nav");
    nav.id = "navai-reference-nav";
    nav.setAttribute("aria-label", "Main navigation");
    nav.innerHTML = `
      <label class="nr-search">
        <span class="nr-search-icon" aria-hidden="true">⌕</span>
        <input id="navai-sidebar-search" type="search" placeholder="Search" autocomplete="off" aria-label="Search chats">
        <span class="nr-shortcut">/</span>
      </label>
      <button type="button" class="nr-link nr-active" data-action="home"><span class="nr-icon">⌂</span><span>Home</span></button>
      <button type="button" class="nr-link" data-action="explore"><span class="nr-icon">◎</span><span>Explore</span></button>
      <button type="button" class="nr-link" data-action="library"><span class="nr-icon">▱</span><span>Library</span></button>
      <button type="button" class="nr-link" data-action="history"><span class="nr-icon">◷</span><span>History</span></button>
      <button type="button" class="nr-link" data-action="interrogations"><span class="nr-icon">⚿</span><span>Interrogations</span></button>
      <div class="nr-label">YOUR CHATS</div>
    `;

    newChat.insertAdjacentElement("afterend", nav);

    const section = sidebar.querySelector(".sidebar-section");
    const headingText = section?.querySelector(".section-heading span");
    if (headingText) headingText.textContent = "TODAY";

    const search = nav.querySelector("#navai-sidebar-search");
    search.addEventListener("input", () => {
      const query = search.value.trim().toLocaleLowerCase();
      [...history.children].forEach(item => {
        const match = item.textContent.toLocaleLowerCase().includes(query);
        item.style.display = match ? "" : "none";
      });
    });

    nav.addEventListener("click", event => {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const action = button.dataset.action;
      nav.querySelectorAll(".nr-link").forEach(link => {
        link.classList.toggle("nr-active", link === button);
      });

      if (action === "home") {
        document.querySelector("#homeBtn")?.click();
      } else if (action === "history") {
        history.scrollIntoView({ behavior:"smooth", block:"start" });
      } else if (action === "explore") {
        window.dispatchEvent(new CustomEvent("navai:explore"));
        showMessage("Explore", "Explore section selected.");
      } else if (action === "library") {
        window.dispatchEvent(new CustomEvent("navai:library"));
        showMessage("Library", "Library section selected.");
      } else if (action === "interrogations") {
        window.dispatchEvent(new CustomEvent("navai:interrogations"));
        showMessage("Interrogations", "Practice section selected.");
      }
    });

    function showMessage(title, message) {
      let notice = nav.querySelector(".nr-notice");
      if (!notice) {
        notice = document.createElement("div");
        notice.className = "nr-notice";
        notice.style.cssText =
          "padding:9px 11px;font-size:12px;line-height:1.5;" +
          "color:var(--muted);overflow-wrap:anywhere;";
        nav.appendChild(notice);
      }
      notice.textContent = title + " — " + message;
    }

    document.addEventListener("keydown", event => {
      if (event.key === "/" &&
          !["INPUT","TEXTAREA"].includes(document.activeElement.tagName) &&
          !document.activeElement.isContentEditable) {
        event.preventDefault();
        search.focus();
      }
      if (event.key === "Escape" && document.activeElement === search) {
        search.value = "";
        search.dispatchEvent(new Event("input"));
        search.blur();
      }
    });

    console.log("NavAI premium sidebar initialized.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once:true });
  } else {
    init();
  }
})();

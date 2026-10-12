(() => {
  if (window.__navAIVoiceInstalled) return;
  window.__navAIVoiceInstalled = true;

  function init() {
    const form = document.getElementById("chatForm");
    const input = document.getElementById("messageInput");
    const plus = document.getElementById("attachBtn");
    const imageInput = document.getElementById("imageInput");

    if (!form || !input || !plus || !imageInput) {
      console.error("NavAI Voice: composer elements not found.");
      return;
    }

    document.getElementById("navai-voice-panel")?.remove();

    const style = document.createElement("style");
    style.textContent = `
      #navai-voice-panel {
        display: none;
        position: absolute;
        left: 0;
        bottom: calc(100% + 10px);
        z-index: 10000;
        width: 245px;
        max-width: calc(100vw - 40px);
        padding: 12px;
        flex-direction: column;
        gap: 8px;
        border: 1px solid #46588c;
        border-radius: 15px;
        background: #10172b;
        color: white;
        box-shadow: 0 12px 35px #0008;
        font: 14px system-ui, sans-serif;
      }
      #navai-voice-panel.open { display: flex; }
      #navai-voice-panel button,
      #navai-voice-panel select {
        width: 100%;
        box-sizing: border-box;
        padding: 10px;
        color: white;
        background: #202b50;
        border: 1px solid #46588c;
        border-radius: 10px;
        font: inherit;
        cursor: pointer;
      }
      #navai-voice-panel #navai-voice-status {
        font-size: 12px;
        color: #c6d2ff;
        overflow-wrap: anywhere;
      }
      #chatForm { position: relative; }
    `;
    document.head.appendChild(style);

    const panel = document.createElement("div");
    panel.id = "navai-voice-panel";
    panel.innerHTML = `
      <strong>NavAI Voice Tools</strong>
      <button type="button" id="navai-image">＋ Attach image</button>
      <hr>
      <button type="button" id="navai-study">📚 Study</button>
      <button type="button" id="navai-mic">🎙️ Speak to type</button>
      <button type="button" id="navai-read">🔊 Read answer</button>
      <button type="button" id="navai-stop">⏹ Stop voice</button>
      <label for="navai-voice-language">Voice language</label>
      <select id="navai-voice-language">
        <option value="hi-IN">Hindi</option>
        <option value="en-IN">English (India)</option>
        <option value="en-US">English (US)</option>
      </select>
      <div id="navai-voice-status" role="status">Voice ready</div>
    `;
    form.appendChild(panel);
    panel.querySelector("#navai-study").addEventListener("click", () => {
      window.dispatchEvent(new Event("navai:study"));
      input.placeholder = "Message Study...";
      input.setAttribute("aria-label", "Message Study");
      panel.classList.remove("open");
      setStatus("Study mode ready. Ask any question.");
      input.focus();
    });



    const status = panel.querySelector("#navai-voice-status");
    const language = panel.querySelector("#navai-voice-language");
    const mic = panel.querySelector("#navai-mic");
    const setStatus = text => { status.textContent = text; };

    // Use the existing + button to open the menu.
    plus.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      panel.classList.toggle("open");
    }, true);

    panel.querySelector("#navai-image").addEventListener("click", () => {
      panel.classList.remove("open");
      imageInput.click();
    });

    document.addEventListener("click", event => {
      if (!panel.contains(event.target) && !plus.contains(event.target)) {
        panel.classList.remove("open");
      }
    });

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let listening = false;

    mic.addEventListener("click", () => {
      if (!SpeechRecognition) {
        setStatus("Voice input unavailable. Try Chrome or Edge.");
        return;
      }
      if (listening && recognition) {
        recognition.stop();
        return;
      }

      recognition = new SpeechRecognition();
      recognition.lang = language.value;
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        listening = true;
        mic.textContent = "⏹ Stop listening";
        setStatus("Listening... Speak now.");
      };

      recognition.onresult = event => {
        const text = event.results[0][0].transcript;
        const setter = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype, "value"
        ).set;
        setter.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
        setStatus("Text added. Check it and press Send.");
      };

      recognition.onerror = event => {
        setStatus(event.error === "not-allowed"
          ? "Allow microphone permission in your browser."
          : "Voice input error: " + event.error);
      };

      recognition.onend = () => {
        listening = false;
        mic.textContent = "🎙️ Speak to type";
      };

      try {
        recognition.start();
      } catch {
        setStatus("Could not start microphone. Try again.");
      }
    });

    panel.querySelector("#navai-read").addEventListener("click", () => {
      if (!window.speechSynthesis) {
        setStatus("Voice playback is not supported in this browser.");
        return;
      }

      const selected = window.getSelection()?.toString().trim();
      const answerSelectors = [
        "#messages .message-row.assistant .message-bubble",
        ".message-row.assistant .message-bubble",
        ".message.assistant",
        ".assistant-message"
      ];

      let answer = selected || "";
      if (!answer) {
        for (const selector of answerSelectors) {
          const messages = document.querySelectorAll(selector);
          if (messages.length) {
            answer = messages[messages.length - 1].innerText.trim();
            break;
          }
        }
      }

      if (!answer) {
        setStatus("No answer found yet. Ask NavAI first.");
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(answer.slice(0, 8000));
      utterance.lang = language.value;
      utterance.onstart = () => setStatus("Reading answer...");
      utterance.onend = () => setStatus("Finished reading.");
      utterance.onerror = () => setStatus("Could not play voice.");
      window.speechSynthesis.speak(utterance);
    });

    panel.querySelector("#navai-stop").addEventListener("click", () => {
      if (recognition && listening) recognition.stop();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setStatus("Voice stopped.");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();







// NAVAI STUDY MODE — additive patch
(() => {
    if (window.__NAVAI_STUDY_MODE_INSTALLED) return;
    window.__NAVAI_STUDY_MODE_INSTALLED = true;

    let studyMode = false;

    const style = document.createElement("style");
    style.textContent = `
      #navai-study-toggle {
        position: fixed; right: 22px; bottom: 100px; z-index: 99999;
        display: flex; align-items: center; gap: 9px;
        padding: 12px 17px; border-radius: 14px;
        border: 1px solid #536dfe; background: #111a32;
        color: #dce5ff; font: 600 14px Arial, sans-serif;
        cursor: pointer; box-shadow: 0 0 22px #536dfe35;
      }
      #navai-study-toggle.active {
        background: #243c91; border-color: #91a7ff;
        box-shadow: 0 0 24px #536dfe75;
      }
      #navai-study-toggle .study-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: #78849d;
      }
      #navai-study-toggle.active .study-dot { background: #73ffbf; }
    `;
    document.head.appendChild(style);

    function addButton() {
        if (!document.body || document.getElementById("navai-study-toggle")) return;

        const button = document.createElement("button");
        button.id = "navai-study-toggle";
        button.type = "button";
        button.innerHTML = '<span class="study-dot"></span><span>Study Mode: OFF</span>';
        button.title = "Toggle Study Mode";

        button.addEventListener("click", () => {
            studyMode = !studyMode;
            button.classList.toggle("active", studyMode);
            button.querySelector("span:last-child").textContent =
                "Study Mode: " + (studyMode ? "ON" : "OFF");
            button.setAttribute("aria-pressed", String(studyMode));
        });

        document.body.appendChild(button);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", addButton, { once: true });
    } else {
        addButton();
    }

    // Attach Study Mode state to NavAI chat requests.
    const originalFetch = window.fetch.bind(window);
    window.fetch = function (resource, options) {
        const url = typeof resource === "string"
            ? resource
            : (resource && resource.url) || "";

        if (studyMode && url.includes("/api/chat") &&
            options && typeof options.body === "string") {
            try {
                const body = JSON.parse(options.body);
                body.study = true;
                options = { ...options, body: JSON.stringify(body) };
            } catch (error) {
                console.warn("NavAI Study Mode could not update this request.", error);
            }
        }

        return originalFetch(resource, options);
    };
})();


/* NAVAI PREMIUM TOOLS MENU */
(() => {
    if (window.__NAVAI_TOOLS_MENU_INSTALLED) return;
    window.__NAVAI_TOOLS_MENU_INSTALLED = true;

    const attach = document.getElementById("attachBtn");
    const input = document.getElementById("imageInput");
    const composer = document.querySelector(".composer");
    if (!attach || !input || !composer) return;

    window.__NAVAI_STUDY_MODE = false;

    const menu = document.createElement("div");
    menu.id = "navai-tools-menu";
    menu.className = "navai-tools-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = `
      <div class="navai-tools-heading">TOOLS & ATTACHMENTS</div>
      <button type="button" class="navai-tool-item" data-tool="files">
        <span class="navai-tool-icon">＋</span>
        <span class="navai-tool-copy">
          <strong>Photos &amp; files</strong>
          <small>Attach an image to your message</small>
        </span>
      </button>
      <button type="button" class="navai-tool-item" data-tool="study">
        <span class="navai-tool-icon">✦</span>
        <span class="navai-tool-copy">
          <strong>Study &amp; Learn</strong>
          <small>Get learning-focused answers</small>
        </span>
        <span class="navai-tool-status" id="navai-study-status">OFF</span>
      </button>
      <div class="navai-tool-item navai-tool-disabled" aria-disabled="true">
        <span class="navai-tool-icon">⌕</span>
        <span class="navai-tool-copy">
          <strong>Web Search</strong>
          <small>Coming soon</small>
        </span>
      </div>
    `;

    const wrap = document.querySelector(".composer-wrap");
    if (!wrap) return;
    wrap.appendChild(menu);

    function closeMenu() {
        menu.classList.remove("is-open");
        attach.setAttribute("aria-expanded", "false");
    }

    function toggleMenu(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (attach.disabled) return;
        menu.classList.toggle("is-open");
        attach.setAttribute(
            "aria-expanded",
            menu.classList.contains("is-open") ? "true" : "false"
        );
    }

    // Intercept the existing + button without replacing its original code.
    attach.addEventListener("click", toggleMenu, true);
    attach.setAttribute("aria-haspopup", "menu");
    attach.setAttribute("aria-expanded", "false");
    attach.setAttribute("title", "Open tools");

    menu.addEventListener("click", event => {
        const item = event.target.closest("[data-tool]");
        if (!item) return;

        if (item.dataset.tool === "files") {
            closeMenu();
            input.click();
        }

        if (item.dataset.tool === "study") {
            window.__NAVAI_STUDY_MODE = !window.__NAVAI_STUDY_MODE;
            const enabled = window.__NAVAI_STUDY_MODE;
            menu.classList.toggle("study-enabled", enabled);
            document.getElementById("navai-study-status").textContent =
                enabled ? "ON" : "OFF";
            item.setAttribute("aria-pressed", String(enabled));
            closeMenu();

            const notice = document.createElement("div");
            notice.className = "navai-mode-notice";
            notice.textContent = enabled
                ? "Study & Learn is ON"
                : "Study & Learn is OFF";
            wrap.appendChild(notice);
            setTimeout(() => notice.remove(), 2200);
        }
    });

    document.addEventListener("click", event => {
        if (!menu.contains(event.target) && !attach.contains(event.target)) {
            closeMenu();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeMenu();
    });

    // Add the Study Mode flag to existing NavAI chat requests.
    // The original script and its response handling remain untouched.
    const originalFetch = window.fetch.bind(window);
    window.fetch = async function(resource, options) {
        const url = typeof resource === "string"
            ? resource
            : (resource && resource.url) || "";

        if (url.includes("/api/chat") && options && typeof options.body === "string") {
            try {
                const body = JSON.parse(options.body);
                body.study = Boolean(window.__NAVAI_STUDY_MODE);
                options = { ...options, body: JSON.stringify(body) };
            } catch (error) {
                console.warn("NavAI Study Mode could not update this request.", error);
            }
        }

        return originalFetch(resource, options);
    };
})();

(() => {
  if (window.__navaiVoiceChatInstalled) return;
  window.__navaiVoiceChatInstalled = true;

  function init() {
    const input = document.querySelector("#messageInput");
    const messages = document.querySelector("#messages");
    const form = input?.closest("form");

    if (!input || !messages || !form) {
      console.error("NavAI Voice Chat: chat elements not found.");
      return;
    }

    const style = document.createElement("style");
    style.textContent = `
      #navai-voice-launch {
        display:inline-flex;align-items:center;justify-content:center;
        gap:7px;margin:0 5px;padding:10px 13px;border-radius:12px;
        border:1px solid #547cff;background:#17274a;color:#fff;
        font:600 13px system-ui;cursor:pointer;
      }
      #navai-voice-launch.active {
        background:#a62f4d;border-color:#ff7895;
      }
      #navai-voice-status {
        display:none;padding:8px 12px;color:#bcd0ff;
        font:12px system-ui;text-align:center;
      }
      #navai-voice-status.visible {display:block}
    `;
    document.head.appendChild(style);

    const button = document.createElement("button");
    button.id = "navai-voice-launch";
    button.type = "button";
    button.textContent = "🎙 Voice Chat";
    button.setAttribute("aria-pressed", "false");

    const status = document.createElement("div");
    status.id = "navai-voice-status";
    status.setAttribute("role", "status");

    const composer = input.closest(".composer") || input.parentElement;
    composer.appendChild(button);
    composer.appendChild(status);

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    let active = false;
    let listening = false;
    let speaking = false;
    let waiting = false;
    let recognition = null;
    let lastSpoken = "";
    let restartTimer = null;
    let speechRun = 0;

    const sayStatus = text => {
      status.textContent = text;
      status.classList.add("visible");
    };

    function stopMic() {
      if (recognition && listening) {
        try { recognition.stop(); } catch {}
      }
    }

    function startMic() {
      if (!active || listening || speaking || waiting) return;

      if (!SpeechRecognition) {
        sayStatus("Voice input is not supported here. Try Chrome.");
        active = false;
        updateButton();
        return;
      }

      const rec = new SpeechRecognition();
      recognition = rec;
      rec.lang = "hi-IN";
      rec.continuous = false;
      rec.interimResults = false;

      rec.onstart = () => {
        if (recognition !== rec) return;
        listening = true;
        sayStatus("🎙 Listening... Speak now.");
      };

      rec.onresult = event => {
        if (recognition !== rec) return;
        const text = event.results?.[0]?.[0]?.transcript?.trim();
        if (!text || !active) return;

        input.value = text;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        waiting = true;
        sayStatus("You: " + text);

        setTimeout(() => {
          if (!active) return;
          if (input.disabled) {
            sayStatus("NavAI is busy. Please wait.");
            waiting = false;
            return;
          }
          form.requestSubmit();
        }, 300);
      };

      rec.onerror = event => {
        if (recognition !== rec) return;
        sayStatus(event.error === "not-allowed"
          ? "Allow microphone permission in your browser."
          : "Voice error: " + event.error);
        if (event.error === "not-allowed" ||
            event.error === "service-not-allowed") {
          active = false;
          waiting = false;
          updateButton();
        }
      };

      rec.onend = () => {
        if (recognition !== rec) return;
        listening = false;
        if (active && !waiting && !speaking) {
          restartTimer = setTimeout(startMic, 700);
        }
      };

      try { rec.start(); }
      catch { sayStatus("Microphone could not start. Tap Voice Chat again."); }
    }

    function updateButton() {
      button.textContent = active ? "⏹ End Voice Chat" : "🎙 Voice Chat";
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }

    function speak(text) {
      if (!active || !text || !("speechSynthesis" in window)) return;
      text = text.trim().slice(0, 6000);
      if (!text || text === lastSpoken) {
        waiting = false;
        return;
      }

      lastSpoken = text;
      const run = ++speechRun;
      speechSynthesis.cancel();
      stopMic();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = /[\u0900-\u097F]/.test(text) ? "hi-IN" : "en-IN";

      utterance.onstart = () => {
        if (run !== speechRun) return;
        speaking = true;
        sayStatus("🔊 NavAI is speaking...");
      };

      utterance.onend = () => {
        if (run !== speechRun) return;
        speaking = false;
        waiting = false;
        if (active) {
          sayStatus("Your turn. Listening...");
          restartTimer = setTimeout(startMic, 600);
        }
      };

      utterance.onerror = () => {
        if (run !== speechRun) return;
        speaking = false;
        waiting = false;
        if (active) restartTimer = setTimeout(startMic, 800);
      };

      speechSynthesis.speak(utterance);
    }

    function latestAssistantText() {
      const rows = messages.querySelectorAll(
        ".message-row.assistant, .message.assistant, [data-role='assistant']"
      );
      const row = rows[rows.length - 1];
      if (row) return row.innerText.trim();

      const children = [...messages.children];
      const last = children[children.length - 1];
      return last?.innerText?.trim() || "";
    }

    let previousText = "";
    const observer = new MutationObserver(() => {
      if (!active || !waiting) return;
      const text = latestAssistantText();
      if (!text || text === previousText) return;

      previousText = text;

      // Wait until the reply stops changing before reading it.
      clearTimeout(window.__navaiVoiceReplyTimer);
      window.__navaiVoiceReplyTimer = setTimeout(() => {
        if (active && waiting) speak(latestAssistantText());
      }, 1100);
    });

    observer.observe(messages, {
      childList: true, subtree: true, characterData: true
    });

    button.addEventListener("click", () => {
      if (active) {
        active = false;
        waiting = false;
        speaking = false;
        clearTimeout(restartTimer);
        clearTimeout(window.__navaiVoiceReplyTimer);
        ++speechRun;
        if ("speechSynthesis" in window) speechSynthesis.cancel();
        stopMic();
        updateButton();
        sayStatus("Voice Chat ended.");
        return;
      }

      if (!SpeechRecognition) {
        sayStatus("Voice recognition is unavailable. Try Chrome on HTTPS.");
        return;
      }

      active = true;
      waiting = false;
      previousText = latestAssistantText();
      updateButton();
      sayStatus("Starting Voice Chat. Allow microphone access.");
      startMic();
    });

    // Detect when NavAI's reply starts appearing.
    form.addEventListener("submit", () => {
      if (!active) return;
      waiting = true;
      previousText = latestAssistantText();
      sayStatus("Sending your question to NavAI...");
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

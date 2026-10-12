(() => {
  if (window.__navAIVoiceInstalled) return;
  window.__navAIVoiceInstalled = true;

  function init() {
    if (!document.body || document.getElementById("navai-voice-panel")) return;

    const style = document.createElement("style");
    style.textContent = `
      #navai-voice-panel {
        position: fixed; right: 22px; bottom: 22px; z-index: 99999;
        display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
        max-width: calc(100vw - 28px); padding: 10px;
        background: rgba(12, 18, 38, .96); color: #fff;
        border: 1px solid rgba(105, 130, 255, .5);
        border-radius: 18px; box-shadow: 0 8px 35px #0007;
        font: 13px/1.4 system-ui, sans-serif; backdrop-filter: blur(16px);
      }
      #navai-voice-panel button, #navai-voice-panel select {
        color: #fff; background: #202b50; border: 1px solid #46588c;
        border-radius: 11px; padding: 10px 12px; cursor: pointer;
        font: inherit;
      }
      #navai-voice-panel button:hover { background: #354a85; }
      #navai-voice-panel button:disabled { opacity: .5; cursor: not-allowed; }
      #navai-voice-panel .navai-voice-primary {
        background: linear-gradient(120deg, #2563eb, #7c3aed);
        border: 0;
      }
      #navai-voice-status {
        flex-basis: 100%; color: #c6d2ff; padding: 0 5px;
        overflow-wrap: anywhere;
      }
      @media(max-width:500px) {
        #navai-voice-panel { right: 10px; bottom: 10px; }
      }
    `;
    document.head.appendChild(style);

    const panel = document.createElement("div");
    panel.id = "navai-voice-panel";
    panel.innerHTML = `
      <button id="navai-mic" class="navai-voice-primary" type="button">🎙️ Speak</button>
      <button id="navai-read" type="button">🔊 Read answer</button>
      <button id="navai-stop" type="button">⏹ Stop</button>
      <select id="navai-voice-language" aria-label="Voice language">
        <option value="hi-IN">Hindi</option>
        <option value="en-IN">English (India)</option>
        <option value="en-US">English (US)</option>
      </select>
      <div id="navai-voice-status" role="status">NavAI Voice ready</div>
    `;
    document.body.appendChild(panel);

    const mic = panel.querySelector("#navai-mic");
    const read = panel.querySelector("#navai-read");
    const stop = panel.querySelector("#navai-stop");
    const language = panel.querySelector("#navai-voice-language");
    const status = panel.querySelector("#navai-voice-status");

    const Recognition = window.SpeechRecognition ||
                        window.webkitSpeechRecognition;
    let recognition = null;
    let listening = false;

    function sayStatus(message) {
      status.textContent = message;
    }

    function findChatInput() {
      const fields = [...document.querySelectorAll(
        "textarea, input[type='text'], input:not([type]), [contenteditable='true']"
      )];

      const candidates = fields.filter(el => {
        if (panel.contains(el) || el.disabled || el.readOnly) return false;
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        const hint = [
          el.placeholder, el.getAttribute("aria-label"),
          el.name, el.id
        ].join(" ").toLowerCase();
        if (/search|username|e-mail|email|password/.test(hint)) return false;
        return true;
      });

      candidates.sort((a, b) => {
        function score(el) {
          const hint = [
            el.placeholder, el.getAttribute("aria-label"),
            el.name, el.id
          ].join(" ").toLowerCase();
          const rect = el.getBoundingClientRect();
          return (el.tagName === "TEXTAREA" ? 100 : 0) +
            (/message|ask|chat|question|type/.test(hint) ? 60 : 0) +
            Math.min(rect.bottom / Math.max(window.innerHeight, 1), 1) * 20;
        }
        return score(b) - score(a);
      });

      return candidates[0] || null;
    }

    function insertTranscript(text) {
      const field = findChatInput();
      if (!field) {
        sayStatus("Chat input nahi mila. Page par chat box kholkar dobara try karo.");
        return;
      }

      field.focus();

      if (field.isContentEditable) {
        field.textContent = text;
        field.dispatchEvent(new InputEvent("input", {
          bubbles: true, inputType: "insertText", data: text
        }));
      } else {
        const proto = field.tagName === "TEXTAREA"
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) setter.call(field, text);
        else field.value = text;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }

      sayStatus("Voice text chat box mein aa gaya. Check karke Send dabao.");
    }

    mic.addEventListener("click", () => {
      if (!Recognition) {
        sayStatus("Voice input supported nahi hai. Updated Chrome ya Edge try karo.");
        return;
      }
      if (listening && recognition) {
        recognition.stop();
        return;
      }

      try {
        recognition = new Recognition();
        recognition.lang = language.value;
        recognition.continuous = false;
        recognition.interimResults = false;
        listening = true;
        mic.textContent = "⏹️ Listening...";
        sayStatus("Sun raha hoon... ab bolo.");

        recognition.onresult = event => {
          const transcript = [...event.results]
            .map(result => result[0].transcript).join(" ").trim();
          if (transcript) insertTranscript(transcript);
          else sayStatus("Kuch sunai nahi diya. Dobara try karo.");
        };

        recognition.onerror = event => {
          const messages = {
            "not-allowed": "Microphone permission allow karo.",
            "no-speech": "Awaaz nahi mili. Dobara try karo.",
            "network": "Speech recognition ke liye network issue hai."
          };
          sayStatus(messages[event.error] || ("Voice error: " + event.error));
        };

        recognition.onend = () => {
          listening = false;
          mic.textContent = "🎙️ Speak";
        };

        recognition.start();
      } catch (error) {
        listening = false;
        mic.textContent = "🎙️ Speak";
        sayStatus("Mic start nahi hua. Page refresh karke try karo.");
      }
    });

    function findLatestAnswer() {
      const selectors = [
        '[data-message-author-role="assistant"]',
        '[data-role="assistant"]',
        '.assistant-message',
        '.message.assistant',
        '.chat-message.assistant',
        '.ai-message',
        '.bot-message',
        '.ai-response',
        '.assistant-response'
      ];

      const found = [];
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (panel.contains(el)) return;
          const rect = el.getBoundingClientRect();
          const text = (el.innerText || el.textContent || "").trim();
          if (rect.width && rect.height && text.length > 1) found.push(el);
        });
      });

      const unique = [...new Set(found)];
      unique.sort((a, b) => {
        if (a === b) return 0;
        return a.compareDocumentPosition(b) &
          Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });

      return unique.length
        ? (unique[unique.length - 1].innerText || "").trim()
        : "";
    }

    read.addEventListener("click", () => {
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        sayStatus("Is browser mein voice playback supported nahi hai.");
        return;
      }

      const selected = window.getSelection()?.toString().trim();
      const answer = selected || findLatestAnswer();

      if (!answer) {
        sayStatus("Answer detect nahi hua. Answer ka text select karke Read answer dabao.");
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(answer.slice(0, 8000));
      utterance.lang = language.value;

      const voices = window.speechSynthesis.getVoices();
      const prefix = language.value.toLowerCase().split("-")[0];
      const voice = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
      if (voice) utterance.voice = voice;

      utterance.onstart = () => sayStatus("NavAI ka answer bol raha hoon...");
      utterance.onend = () => sayStatus("Voice playback complete.");
      utterance.onerror = () => sayStatus("Voice playback nahi ho paya.");
      window.speechSynthesis.speak(utterance);
    });

    stop.addEventListener("click", () => {
      if (recognition && listening) recognition.stop();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      sayStatus("Voice stopped.");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
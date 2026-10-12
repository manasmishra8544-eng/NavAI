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
      <strong>📚 Study</strong>
      <button type="button" id="navai-study-explain">📘 Explain Topic</button>
      <button type="button" id="navai-study-notes">📝 Make Notes</button>
      <button type="button" id="navai-study-quiz">🧠 Practice Quiz</button>
      <button type="button" id="navai-study-formulas">📐 Revise Formulas</button>
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
    const studyPrompts = {
      "navai-study-explain": "Act as my personal study tutor for any class, course, exam, or topic. Explain my topic from the basics in simple Hinglish, step by step, with examples. Topic: ",
      "navai-study-notes": "Make clear, exam-ready revision notes for any class, course, subject, or topic in simple language. Include important definitions, key points and examples. Subject and chapter: ",
      "navai-study-quiz": "Create a practice quiz for any class, course, subject, or topic. Ask one question at a time, wait for my answer, check it, explain mistakes and keep score. Subject and chapter: ",
      "navai-study-formulas": "Help me revise formulas and key concepts for any class or subject. List the important formulas for my chapter, explain each symbol and give one example. Subject and chapter: "
    };

    panel.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button || !studyPrompts[button.id]) return;

      input.value = studyPrompts[button.id];
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      panel.classList.remove("open");
      setStatus("Study Mode ready. Add your subject or chapter, then press Send.");
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



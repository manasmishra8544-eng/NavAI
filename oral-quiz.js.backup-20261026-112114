(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const ui = {
    mic: $("mic"), caption: $("orbCaption"), hint: $("hint"),
    status: $("status"), connection: $("connection"),
    transcript: $("transcript"), reply: $("reply"),
    repeat: $("repeat"), unknown: $("unknown"), pause: $("pause")
  };

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  let recognizer = null;
  let active = false;
  let speaking = false;
  let busy = false;
  let shouldListen = false;
  let recognitionRunning = false;
  let lastSpoken = "";
  let lastQuestion = "";
  let restartTimer = null;
  let phraseTimer = null;
  let pendingFinal = "";
  let lastHandledText = "";
  let lastHandledAt = 0;
  let sessionToken = 0;

  const history = [];
  const MAX_HISTORY = 16;
  const RESTART_DELAY = 250;
  const PHRASE_WAIT = 1400;

  function status(message) {
    if (ui.status) ui.status.textContent = message;
  }

  function caption(message) {
    if (ui.caption) ui.caption.textContent = message;
  }

  function connection(message) {
    if (ui.connection && ui.connection.lastChild) {
      ui.connection.lastChild.textContent = " " + message;
    }
  }

  function showAssistant(text) {
    if (ui.reply) ui.reply.textContent = text;
    if (ui.transcript) ui.transcript.textContent = text;
  }

  function clearListeningTimers() {
    clearTimeout(restartTimer);
    clearTimeout(phraseTimer);
    restartTimer = null;
    phraseTimer = null;
  }

  function stopRecognition() {
    clearTimeout(restartTimer);
    restartTimer = null;

    if (recognizer && recognitionRunning) {
      try {
        recognizer.stop();
      } catch (_) {}
    }
  }

  function normalize(text) {
    return String(text || "").toLowerCase()
      .replace(/[.,!?;:।]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Add a language selector without changing the existing HTML.
  function addLanguageSelector() {
    if (!ui.hint || $("oralQuizLanguage")) return;

    const wrap = document.createElement("label");
    wrap.style.cssText =
      "display:flex;align-items:center;justify-content:center;gap:10px;" +
      "flex-wrap:wrap;margin:12px auto 18px;color:inherit;font-size:14px;";

    const label = document.createElement("span");
    label.textContent = "Listening language";

    const select = document.createElement("select");
    select.id = "oralQuizLanguage";
    select.setAttribute("aria-label", "Choose speech recognition language");
    select.style.cssText =
      "max-width:100%;padding:10px 12px;border-radius:12px;" +
      "border:1px solid #52658a;background:#101b32;color:inherit;" +
      "font:inherit;";

    [
      ["hi-IN", "Hindi / Hinglish"],
      ["en-IN", "English (India)"],
      ["en-US", "English (US)"]
    ].forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.appendChild(option);
    });

    select.value = "hi-IN";
    select.addEventListener("change", () => {
      if (recognizer) recognizer.lang = select.value;
      status("Listening language: " + select.options[select.selectedIndex].text);

      if (active && shouldListen && !busy && !speaking) {
        stopRecognition();
        queueListen(350);
      }
    });

    wrap.append(label, select);
    ui.hint.insertAdjacentElement("afterend", wrap);
  }

  function listen() {
    if (!active || !shouldListen || speaking || busy || !recognizer) return;
    if (recognitionRunning) return;

    try {
      recognizer.lang = $("oralQuizLanguage")?.value || "hi-IN";
      recognizer.start();
      recognitionRunning = true;
      ui.mic?.classList.add("listening");
      caption("I'M LISTENING — SPEAK AT YOUR OWN PACE");
      connection("LISTENING");
      status("NavAI is listening. Take your time; you don't need to speak quickly.");
    } catch (error) {
      if (error.name !== "InvalidStateError") {
        status("Couldn't start listening. Tap the microphone to try again.");
      }
      queueListen(700);
    }
  }

  function queueListen(delay = RESTART_DELAY) {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      listen();
    }, delay);
  }

  function flushPendingSpeech() {
    clearTimeout(phraseTimer);
    phraseTimer = null;

    const heard = pendingFinal.trim();
    pendingFinal = "";

    if (!heard || !active || busy || speaking) return;

    const key = normalize(heard);
    const now = Date.now();

    // Avoid an accidental duplicate final result.
    if (key && key === lastHandledText && now - lastHandledAt < 3500) {
      queueListen();
      return;
    }

    lastHandledText = key;
    lastHandledAt = now;
    handleSpeech(heard);
  }

  function speak(text) {
    return new Promise(resolve => {
      if (!text || !("speechSynthesis" in window)) {
        speaking = false;
        resolve();
        return;
      }

      speechSynthesis.cancel();
      speaking = true;
      stopRecognition();

      ui.mic?.classList.remove("listening");
      ui.mic?.classList.add("speaking");
      caption("NAVAI IS SPEAKING");
      connection("SPEAKING");
      lastSpoken = text;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.96;
      utterance.pitch = 1.04;
      utterance.volume = 1;

      const voices = speechSynthesis.getVoices();
      const selectedLang = $("oralQuizLanguage")?.value || "hi-IN";
      const preferred = voices.find(v =>
        v.lang.toLowerCase() === selectedLang.toLowerCase()
      ) || voices.find(v => /hi-IN/i.test(v.lang)) ||
        voices.find(v => /en-IN/i.test(v.lang)) ||
        voices.find(v => /en-US|en-GB/i.test(v.lang));

      if (preferred) utterance.voice = preferred;

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        speaking = false;
        ui.mic?.classList.remove("speaking");

        if (active && shouldListen && !busy) queueListen(350);
        resolve();
      };

      utterance.onend = finish;
      utterance.onerror = finish;

      try {
        speechSynthesis.speak(utterance);
      } catch (_) {
        finish();
      }
    });
  }

  function getReply(data) {
    if (typeof data === "string") return data;
    return data.reply || data.response || data.answer || data.content ||
      data.message || data.text ||
      data.choices?.[0]?.message?.content ||
      data.result?.reply || data.result?.content || "";
  }

  function buildPrompt(heard) {
    return [
      "You are NavAI, a warm, natural, patient voice tutor for a school student.",
      "Speak in simple Hindi, Hinglish or English, matching the student's language.",
      "The student is speaking and cannot type. Never ask them to type.",
      "Keep responses concise and natural for speech. Do not use markdown or stage directions.",
      "If the student names a subject or chapter, acknowledge it and ask one oral question.",
      "Ask exactly one question at a time and wait for the spoken answer.",
      "Evaluate answers fairly, including equivalent wording. Explain mistakes simply and check understanding.",
      "If the student says they do not know, explain the answer and ask one short check question.",
      "If they ask to repeat, repeat the latest question in the same wording.",
      "If they ask to explain, explain the current concept with a simple example.",
      "If they say next, ask the next question on the same topic.",
      "If the topic is unclear, ask which subject or chapter they want to study.",
      "Conversation so far: " + JSON.stringify(history.slice(-MAX_HISTORY)),
      "Student just said: " + heard,
      "Respond only with the words you want to say aloud."
    ].join("\n\n");
  }

  async function askAI(heard) {
    if (busy || !active) return;

    busy = true;
    clearTimeout(phraseTimer);
    pendingFinal = "";
    stopRecognition();
    ui.mic?.classList.remove("listening");
    caption("THINKING...");
    status("NavAI is thinking...");
    connection("THINKING");

    const token = sessionToken;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: buildPrompt(heard),
          history: []
        })
      });

      const raw = await response.text();
      let data;

      try {
        data = JSON.parse(raw);
      } catch (_) {
        data = raw;
      }

      if (!response.ok) {
        throw new Error(
          typeof data === "object"
            ? (data.error || data.message || "AI request failed")
            : "AI request failed"
        );
      }

      const answer = getReply(data);

      if (!answer || typeof answer !== "string") {
        throw new Error("NavAI returned an empty response.");
      }

      if (token !== sessionToken || !active) return;

      history.push({ student: heard, tutor: answer });
      if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
      }

      lastQuestion = answer;
      showAssistant(answer);
      status("Your turn. Speak naturally; slow speech is okay.");
      await speak(answer);
    } catch (error) {
      if (token !== sessionToken || !active) return;

      const message = "Sorry, I couldn't connect just now. Please try saying that again.";
      showAssistant(message);
      status("Connection problem: " + error.message);
      await speak(message);
    } finally {
      busy = false;

      if (active && shouldListen && !speaking) {
        queueListen(350);
      }
    }
  }

  function commandFor(text) {
    const t = normalize(text);

    if (/^(repeat|repeat it|repeat please|say again|say that again|dobara|phir se|phir se bolo|repeat karo|question repeat karo)$/.test(t) ||
        /\b(repeat the question|repeat question|question repeat|dobara bolo|phir se batao)\b/.test(t)) {
      return "repeat";
    }

    if (/\b(answer nahi pata|i don't know|dont know|not sure|no idea|pata nahi|mujhe nahi pata|answer nahin pata)\b/.test(t)) {
      return "unknown";
    }

    if (/^(next|next question|agla|agla question|aage|move on|skip)$/.test(t)) return "next";
    if (/\b(explain|samjhao|samjha do|explain it|teach me)\b/.test(t)) return "explain";
    if (/^(stop|stop now|band karo|bas karo|end session|quit|pause)$/.test(t)) return "stop";
    if (/^(start|start again|resume|continue|shuru karo|chalo shuru)$/.test(t)) return "start";

    return "";
  }

  async function handleSpeech(text) {
    const heard = text.trim();
    if (!heard || busy || speaking || !active) return;

    ui.transcript.textContent = "You: " + heard;
    ui.reply.textContent = "";

    const command = commandFor(heard);

    if (command === "repeat") {
      await speak(lastQuestion || "Pehle apna subject ya topic batao.");
      return;
    }

    if (command === "unknown") {
      await askAI("I do not know the answer to the current question. Explain it simply, then check my understanding.");
      return;
    }

    if (command === "next") {
      await askAI("Ask the next oral question on the same topic. Ask only one question.");
      return;
    }

    if (command === "explain") {
      await askAI("Explain the current concept simply with an easy example, then ask one short check question.");
      return;
    }

    if (command === "stop") {
      await stopSession(true);
      return;
    }

    if (command === "start") {
      await askAI("Let's continue our oral preparation. Ask the next question on the same topic.");
      return;
    }

    await askAI(heard);
  }

  function setupRecognition() {
    if (!Recognition) return false;

    recognizer = new Recognition();
    recognizer.lang = "hi-IN";
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 3;

    recognizer.onstart = () => {
      recognitionRunning = true;
      ui.mic?.classList.add("listening");
      caption("I'M LISTENING — TAKE YOUR TIME");
      connection("LISTENING");
    };

    recognizer.onresult = event => {
      if (!active || busy || speaking) return;

      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript?.trim();

        if (!transcript) continue;

        if (result.isFinal) {
          pendingFinal = (pendingFinal + " " + transcript).trim();
        } else {
          interim += (interim ? " " : "") + transcript;
        }
      }

      // Show live transcription while the student is still speaking.
      if (interim && ui.transcript) {
        ui.transcript.textContent = "You: " + (pendingFinal ? pendingFinal + " " : "") + interim;
        caption("HEARING YOU...");
        status("Speech detected. Keep speaking at your own pace.");
      }

      // Wait briefly after final words so short pauses don't split a sentence.
      if (pendingFinal) {
        clearTimeout(phraseTimer);
        phraseTimer = setTimeout(flushPendingSpeech, PHRASE_WAIT);
      }
    };

    recognizer.onerror = event => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        status("Microphone permission is blocked. Allow microphone access in Chrome settings.");
        shouldListen = false;
        caption("MICROPHONE PERMISSION NEEDED");
      } else if (event.error === "no-speech") {
        status("Still listening. Start speaking whenever you're ready.");
      } else if (event.error === "audio-capture") {
        status("No microphone detected. Check your microphone connection.");
      } else if (event.error !== "aborted") {
        status("Voice input issue: " + event.error + ". Trying to recover...");
      }
    };

    recognizer.onend = () => {
      recognitionRunning = false;
      ui.mic?.classList.remove("listening");

      if (pendingFinal && active && shouldListen && !busy && !speaking) {
        clearTimeout(phraseTimer);
        phraseTimer = setTimeout(flushPendingSpeech, 350);
        return;
      }

      if (active && shouldListen && !speaking && !busy) {
        queueListen();
      }
    };

    return true;
  }

  async function startSession() {
    if (!Recognition) {
      status("Voice recognition isn't supported here. Try the latest Google Chrome.");
      return;
    }

    if (active) {
      shouldListen = true;
      if (!speaking && !busy) listen();
      return;
    }

    if (!recognizer && !setupRecognition()) return;

    active = true;
    shouldListen = true;
    sessionToken++;
    pendingFinal = "";
    lastHandledText = "";

    ui.pause.innerHTML = "<span>Ⅱ</span> Pause";
    status("Voice session started.");
    showAssistant("Hey! I'm NavAI. What subject or topic would you like to prepare today?");
    await speak("Hey! I'm NavAI. What subject or topic would you like to prepare today?");
  }

  async function stopSession(sayGoodbye) {
    sessionToken++;
    active = false;
    shouldListen = false;
    busy = false;
    pendingFinal = "";
    clearListeningTimers();
    stopRecognition();

    if ("speechSynthesis" in window) speechSynthesis.cancel();

    speaking = false;
    recognitionRunning = false;
    ui.mic?.classList.remove("listening", "speaking");
    caption("TAP TO START TALKING");
    connection("READY");
    status("Session paused. Tap the microphone to continue.");

    if (sayGoodbye) {
      showAssistant("Session paused. Tap the microphone whenever you're ready to continue.");
    }
  }

  addLanguageSelector();

  ui.mic.addEventListener("click", () => {
    if (active) {
      shouldListen = true;
      if (!speaking && !busy) listen();
      status("I'm here. Go ahead and speak at your own pace.");
    } else {
      startSession();
    }
  });

  ui.repeat.addEventListener("click", async () => {
    if (lastQuestion) await speak(lastQuestion);
    else await speak("Tell me your topic first and we'll begin.");
  });

  ui.unknown.addEventListener("click", () => {
    if (!active) return startSession();
    askAI("I do not know the answer to the current question. Explain the correct answer simply, then check my understanding.");
  });

  ui.pause.addEventListener("click", () => stopSession(true));

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && active) {
      status("Keep this page open and visible for the most reliable voice listening.");
    }
  });

  window.addEventListener("beforeunload", () => {
    clearListeningTimers();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    if (recognizer) {
      try { recognizer.abort(); } catch (_) {}
    }
  });

  if (!Recognition) {
    status("For voice mode, open this page in a supported browser such as current Chrome.");
  } else {
    status("Choose Hindi / Hinglish or English, then tap the microphone to begin.");
  }
})();

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const ui = {
    mic: $("mic"),
    caption: $("orbCaption"),
    hint: $("hint"),
    status: $("status"),
    connection: $("connection"),
    transcript: $("transcript"),
    reply: $("reply"),
    repeat: $("repeat"),
    unknown: $("unknown"),
    pause: $("pause")
  };

  const Recognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  let recognizer = null;
  let active = false;
  let speaking = false;
  let busy = false;
  let shouldListen = false;
  let recognitionRunning = false;
  let examMode = false;
  let lastSpoken = "";
  let lastQuestion = "";
  let pendingFinal = "";
  let lastHandledText = "";
  let lastHandledAt = 0;
  let restartTimer = null;
  let phraseTimer = null;
  let sessionToken = 0;

  const history = [];
  const MAX_HISTORY = 16;
  const PHRASE_WAIT = 1800;

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
  }

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[.,!?;:।]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function clearTimers() {
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

  function queueListen(delay = 300) {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      listen();
    }, delay);
  }

  function listen() {
    if (!active || !shouldListen || speaking || busy || !recognizer) return;
    if (recognitionRunning) return;

    try {
      recognizer.start();
    } catch (error) {
      if (error.name !== "InvalidStateError") {
        status("Mic start nahi hua. Microphone button dobara tap karo.");
      }
      queueListen(700);
    }
  }

  function chooseVoice(text) {
    if (!("speechSynthesis" in window)) return null;

    const voices = speechSynthesis.getVoices();
    const devanagari = /[\u0900-\u097F]/.test(text);

    const preferredLanguages = devanagari
      ? ["hi-IN", "hi"]
      : ["en-IN", "en-GB", "en-US", "hi-IN"];

    for (const lang of preferredLanguages) {
      const voice = voices.find(v =>
        v.lang.toLowerCase() === lang.toLowerCase()
      );
      if (voice) return voice;
    }

    return voices.find(v => /^en/i.test(v.lang)) || voices[0] || null;
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
      lastQuestion = text;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.82;
      utterance.pitch = 1.03;
      utterance.volume = 1;

      const voice = chooseVoice(text);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = "en-IN";
      }

      let finished = false;

      function finish() {
        if (finished) return;
        finished = true;
        speaking = false;
        ui.mic?.classList.remove("speaking");

        if (active && shouldListen && !busy) queueListen(350);
        resolve();
      }

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

    return data?.reply ||
      data?.response ||
      data?.answer ||
      data?.content ||
      data?.message ||
      data?.text ||
      data?.choices?.[0]?.message?.content ||
      data?.result?.reply ||
      data?.result?.content ||
      "";
  }

  function buildPrompt(heard) {
    const modeInstructions = examMode
      ? [
          "CURRENT MODE: EXAM PREPARATION.",
          "Act as a patient oral examiner and tutor.",
          "Ask only ONE question at a time and wait for the student's answer.",
          "When the student answers, judge it fairly, accept equivalent wording, and briefly explain mistakes.",
          "Then ask the next question on the same topic unless they change topics.",
          "If no subject or topic is known, ask which subject or topic they want to practise.",
          "Do not invent a score. Give a score only when enough answers have actually been assessed."
        ].join("\n")
      : [
          "CURRENT MODE: FRIEND CHAT.",
          "Talk naturally like a helpful, friendly conversation partner.",
          "Answer whatever the student asks: everyday questions, ideas, jokes, technology, schoolwork, explanations, or casual conversation.",
          "Do NOT turn ordinary messages into quizzes.",
          "Do NOT ask a study question just because the student mentions a subject.",
          "Ask a follow-up only when it naturally helps the conversation.",
          "If the student asks to learn something, explain it clearly with a simple example when useful."
        ].join("\n");

    return [
      "You are NavAI, a friendly, respectful, natural voice conversation partner and study tutor.",
      "SOUND NATURAL: Talk like a patient, helpful person having a real conversation. Respond directly to what was said. Use natural sentence flow and contractions where appropriate. Avoid repetitive greetings, stiff textbook language, unnecessary formalities, and repeating the student's question. Show understanding when the student sounds confused, then explain calmly in everyday words.",
      "LISTENING BEHAVIOUR: Let the student finish their thought, including natural pauses. If their message is understandable, answer directly instead of asking them to repeat or confirm it. Use conversation history to understand context. Ask for clarification only if the important words genuinely cannot be understood; if only a small detail is unclear, answer the part you understood first.",
      "For simple questions, answer simply. For learning questions, explain one idea at a time and use a familiar example when helpful. Do not overwhelm the student with a long lecture unless they ask for detail. Never pretend to have feelings, personal experiences, or abilities you do not have.",
      "LANGUAGE RULE: Match the language of the latest spoken message. English input = natural English. Hindi input in Devanagari = simple Hindi in Devanagari. Hinglish input = natural Roman-script Hinglish. Do not switch languages unnecessarily.",
      "Explain patiently in simple, clear language. For learning questions, explain step by step and add an easy everyday example when useful. Avoid difficult words unless you explain them. Keep answers focused, but give enough detail to make the idea understandable. Never rush the explanation.",
      "Avoid Markdown, bullet symbols, stage directions, and robotic greetings. Do not claim you heard words that are not in the transcript.",
      "Remember the conversation context below. Answer the latest message directly.",
      modeInstructions,
      "Conversation history: " + JSON.stringify(history.slice(-MAX_HISTORY)),
      "Latest student message: " + heard,
      "Return only the response to say aloud."
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
        const errorMessage =
          typeof data === "object"
            ? data.error || data.message || "AI request failed"
            : "AI request failed";

        throw new Error(errorMessage);
      }

      const answer = getReply(data).trim();

      if (!answer) throw new Error("NavAI returned an empty response.");
      if (token !== sessionToken || !active) return;

      history.push({ student: heard, tutor: answer });
      if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
      }

      showAssistant(answer);
      status(examMode
        ? "Exam mode: answer the next question when you're ready."
        : "Your turn. Speak naturally whenever you're ready.");

      await speak(answer);
    } catch (error) {
      if (token !== sessionToken || !active) return;

      const message =
        "Sorry, I couldn't connect right now. Please try again in a moment.";

      showAssistant(message);
      status("Connection problem: " + error.message);
      await speak(message);
    } finally {
      busy = false;

      if (active && shouldListen && !speaking) queueListen(350);
    }
  }

  function detectCommand(text) {
    const t = normalize(text);

    if (
      /\b(quiz me|take my test|start a quiz|start exam mode|exam preparation|oral test|test me)\b/.test(t) ||
      /\b(mera test lo|mera quiz lo|quiz shuru karo|test shuru karo|exam ki tayari|exam ki taiyari|mujhe quiz karo)\b/.test(t)
    ) return "exam";

    if (
      /\b(friend mode|normal chat|normal conversation|stop exam mode|exit exam|stop the quiz|quiz band karo|test band karo|normal baat karo|friend ki tarah baat karo)\b/.test(t)
    ) return "friend";

    if (
      /^(repeat|repeat it|repeat please|say again|say that again|dobara|phir se|phir se bolo|repeat karo)$/.test(t) ||
      /\b(repeat the question|repeat question|dobara bolo|phir se batao)\b/.test(t)
    ) return "repeat";

    if (
      /\b(i don't know|i dont know|not sure|no idea|pata nahi|mujhe nahi pata|answer nahi pata|answer nahin pata)\b/.test(t)
    ) return "unknown";

    if (/^(next|next question|agla|agla question|aage|move on|skip)$/.test(t)) {
      return "next";
    }

    if (/\b(explain|samjhao|samjha do|teach me|explain it)\b/.test(t)) {
      return "explain";
    }

    if (/^(pause|stop listening|band karo|bas karo|end session|quit)$/.test(t)) {
      return "stop";
    }

    if (/^(resume|continue listening|start again|shuru karo)$/.test(t)) {
      return "start";
    }

    return "";
  }

  async function handleSpeech(text) {
    const heard = text.trim();
    if (!heard || busy || speaking || !active) return;

    if (ui.transcript) ui.transcript.textContent = "You: " + heard;
    showAssistant("");

    const command = detectCommand(heard);

    if (command === "exam") {
      examMode = true;
      await askAI(
        "The student has explicitly requested exam preparation. Confirm briefly that exam mode is on, then ask which subject or topic to practise if it is not already clear."
      );
      return;
    }

    if (command === "friend") {
      examMode = false;
      await askAI(
        "The student wants normal friend chat again. Confirm briefly that friend mode is on, then continue the conversation naturally."
      );
      return;
    }

    if (command === "repeat") {
      await speak(lastQuestion || "Go ahead, tell me what you'd like to talk about.");
      return;
    }

    if (command === "unknown") {
      if (examMode) {
        await askAI(
          "The student does not know the answer. Explain the correct answer simply and kindly, then ask one short check question."
        );
      } else {
        await askAI(heard);
      }
      return;
    }

    if (command === "next" && examMode) {
      await askAI(
        "Ask the next oral exam question on the current topic. Ask only one question."
      );
      return;
    }

    if (command === "explain" && examMode) {
      await askAI(
        "Explain the current exam concept simply with an example, then ask one short check question."
      );
      return;
    }

    if (command === "stop") {
      await stopSession(true);
      return;
    }

    if (command === "start") {
      shouldListen = true;
      status("I'm here. Go ahead and speak.");
      if (!speaking && !busy) listen();
      return;
    }

    await askAI(heard);
  }

  function flushPendingSpeech() {
    clearTimeout(phraseTimer);
    phraseTimer = null;

    const heard = pendingFinal.trim();
    pendingFinal = "";

    if (!heard || !active || busy || speaking) return;

    const key = normalize(heard);
    const now = Date.now();

    if (key && key === lastHandledText && now - lastHandledAt < 3000) {
      queueListen();
      return;
    }

    lastHandledText = key;
    lastHandledAt = now;
    handleSpeech(heard);
  }

  function setupRecognition() {
    if (!Recognition) return false;

    recognizer = new Recognition();

    // Browser speech recognition uses one locale at a time.
    // The AI reply language follows the recognised transcript.
    recognizer.lang = "en-IN";
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 3;

    recognizer.onstart = () => {
      recognitionRunning = true;
      ui.mic?.classList.add("listening");
      caption("I'M LISTENING — SPEAK NATURALLY");
      connection("LISTENING");
      status("I'm listening. Take your time.");
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

      if (interim && ui.transcript) {
        ui.transcript.textContent =
          "You: " + (pendingFinal ? pendingFinal + " " : "") + interim;
        caption("HEARING YOU...");
      }

      if (pendingFinal) {
        clearTimeout(phraseTimer);
        phraseTimer = setTimeout(flushPendingSpeech, PHRASE_WAIT);
      }
    };

    recognizer.onerror = event => {
      if (event.error === "not-allowed" ||
          event.error === "service-not-allowed") {
        shouldListen = false;
        status("Allow microphone access in Chrome site settings.");
        caption("MICROPHONE PERMISSION NEEDED");
      } else if (event.error === "audio-capture") {
        status("No microphone detected. Check your microphone.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        status("Voice input issue: " + event.error + ". Retrying...");
      }
    };

    recognizer.onend = () => {
      recognitionRunning = false;
      ui.mic?.classList.remove("listening");

      if (pendingFinal && active && shouldListen && !busy && !speaking) {
        clearTimeout(phraseTimer);
        phraseTimer = setTimeout(flushPendingSpeech, 900);
        return;
      }

      if (active && shouldListen && !speaking && !busy) {
        queueListen(350);
      }
    };

    return true;
  }

  async function startSession() {
    if (!Recognition) {
      status("Voice recognition isn't supported. Try current Google Chrome.");
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

    if (ui.pause) ui.pause.textContent = "Ⅱ Pause";

    caption("LET'S TALK");
    connection("READY");
    status("Friend mode is on. Ask me anything.");

    const greeting =
      "Hey! I'm NavAI. We can talk about anything, or prepare for exams whenever you want.";

    showAssistant(greeting);
    await speak(greeting);
  }

  async function stopSession(sayPaused) {
    sessionToken++;
    active = false;
    shouldListen = false;
    busy = false;
    pendingFinal = "";

    clearTimers();
    stopRecognition();

    if ("speechSynthesis" in window) speechSynthesis.cancel();

    speaking = false;
    recognitionRunning = false;

    ui.mic?.classList.remove("listening", "speaking");
    caption("TAP TO START TALKING");
    connection("READY");
    status("Session paused. Tap the microphone to continue.");

    if (ui.pause) ui.pause.textContent = "Ⅱ Pause";

    if (sayPaused) {
      showAssistant("Paused for now. Tap the microphone whenever you're ready.");
    }
  }

  if (ui.mic) {
    ui.mic.addEventListener("click", () => {
      if (active) {
        shouldListen = true;
        if (!speaking && !busy) listen();
        status("I'm here. Go ahead and speak.");
      } else {
        startSession();
      }
    });
  }

  if (ui.repeat) {
    ui.repeat.addEventListener("click", async () => {
      if (!active) {
        await startSession();
        return;
      }

      await speak(lastQuestion || "Tell me anything you'd like to talk about.");
    });
  }

  if (ui.unknown) {
    ui.unknown.addEventListener("click", () => {
      if (!active) {
        startSession();
      } else if (examMode) {
        askAI(
          "I do not know the answer to the current exam question. Explain it simply, then ask one short check question."
        );
      } else {
        askAI("Please explain the last topic more simply.");
      }
    });
  }

  if (ui.pause) {
    ui.pause.addEventListener("click", () => stopSession(true));
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && active) {
      status("Keep this page open and visible for the best voice experience.");
    }
  });

  window.addEventListener("beforeunload", () => {
    clearTimers();
    if ("speechSynthesis" in window) speechSynthesis.cancel();

    if (recognizer) {
      try {
        recognizer.abort();
      } catch (_) {}
    }
  });

  if (!Recognition) {
    status("For voice mode, open this page in a supported browser such as Chrome.");
  } else {
    status("Tap the microphone to chat with NavAI.");
  }
})();

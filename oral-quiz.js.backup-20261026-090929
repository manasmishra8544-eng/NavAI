(() => {
  const $ = id => document.getElementById(id);
  const ui = {
    mic: $("mic"), caption: $("orbCaption"), hint: $("hint"),
    status: $("status"), connection: $("connection"),
    transcript: $("transcript"), reply: $("reply"),
    repeat: $("repeat"), unknown: $("unknown"), pause: $("pause")
  };

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null, active = false, speaking = false, busy = false;
  let shouldListen = false, lastSpoken = "", lastQuestion = "", topicKnown = false;
  let restartTimer = null;
  const history = [];
  const MAX_HISTORY = 16;

  function status(message) { ui.status.textContent = message; }
  function caption(message) { ui.caption.textContent = message; }
  function showAssistant(text) {
    ui.reply.textContent = text;
    ui.transcript.textContent = text;
  }

  function stopRecognition() {
    if (recognizer) {
      try { recognizer.stop(); } catch (_) {}
    }
  }

  function listen() {
    if (!active || !shouldListen || speaking || busy || !recognizer) return;
    try {
      recognizer.start();
      ui.mic.classList.add("listening");
      caption("I'M LISTENING");
      ui.connection.lastChild.textContent = " LISTENING";
    } catch (_) {}
  }

  function queueListen() {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(listen, 450);
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
      ui.mic.classList.remove("listening");
      ui.mic.classList.add("speaking");
      caption("NAVAI IS SPEAKING");
      ui.connection.lastChild.textContent = " SPEAKING";
      lastSpoken = text;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.96;
      utterance.pitch = 1.04;
      utterance.volume = 1;
      const voices = speechSynthesis.getVoices();
      const preferred = voices.find(v => /en-IN/i.test(v.lang)) ||
        voices.find(v => /en-US|en-GB/i.test(v.lang));
      if (preferred) utterance.voice = preferred;
      utterance.onend = () => {
        speaking = false;
        ui.mic.classList.remove("speaking");
        if (active && shouldListen) queueListen();
        resolve();
      };
      utterance.onerror = () => {
        speaking = false;
        ui.mic.classList.remove("speaking");
        if (active && shouldListen) queueListen();
        resolve();
      };
      speechSynthesis.speak(utterance);
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
      "You are NavAI, a warm, natural, patient voice-only tutor for a school student.",
      "Speak like a helpful human tutor in simple Hinglish or the language the student uses.",
      "This is an ongoing oral learning conversation. The student cannot type; never ask them to type.",
      "Keep each spoken response concise and natural. Do not use markdown, lists, symbols, or stage directions.",
      "If the student is telling you a topic or asking to prepare a chapter, acknowledge it and immediately ask one suitable first oral question.",
      "Ask exactly one question at a time and wait for the student's spoken answer.",
      "Evaluate each answer fairly. Accept correct answers expressed in different words. If partly correct, gently say what is missing. If wrong, explain the correct concept in easy words, then ask one small follow-up to check understanding.",
      "If the student says they do not know, give the correct answer and a clear, simple explanation, then check understanding before moving forward.",
      "If they ask to repeat, repeat the most recent question in the same wording without adding a new question.",
      "If they ask for an explanation, explain the current concept. If they say next, ask the next question about the same topic.",
      "If the topic is unclear, ask what subject or chapter they want to prepare, by voice.",
      "Do not claim that an answer is correct without checking it. Stay on the student's topic and adapt the difficulty.",
      "Conversation so far: " + JSON.stringify(history.slice(-MAX_HISTORY)),
      "Student just said: " + heard,
      "Respond only with what you want to say aloud."
    ].join("\n\n");
  }

  async function askAI(heard) {
    busy = true;
    stopRecognition();
    ui.mic.classList.remove("listening");
    caption("THINKING...");
    status("NavAI is thinking...");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: buildPrompt(heard), history: [] })
      });
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); } catch (_) { data = raw; }
      if (!response.ok) {
        throw new Error(typeof data === "object" ? (data.error || data.message || "AI request failed") : "AI request failed");
      }
      const answer = getReply(data);
      if (!answer || typeof answer !== "string") {
        throw new Error("NavAI returned an empty response. Please try again.");
      }
      history.push({ student: heard, tutor: answer });
      if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
      topicKnown = true;
      lastQuestion = answer;
      showAssistant(answer);
      status("Your turn. Speak naturally when NavAI finishes.");
      await speak(answer);
    } catch (error) {
      const message = "Sorry, I couldn't connect just now. Please say that again.";
      showAssistant(message);
      status("Connection problem: " + error.message);
      await speak(message);
    } finally {
      busy = false;
      if (active && shouldListen && !speaking) queueListen();
    }
  }

  function commandFor(text) {
    const t = text.toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();
    if (/^(repeat|repeat it|repeat please|say again|say that again|dobara|phir se|phir se bolo|repeat karo)$/.test(t) ||
        /\b(repeat the question|repeat question|question repeat|dobara bolo|phir se batao)\b/.test(t)) return "repeat";
    if (/\b(answer nahi pata|i don't know|dont know|not sure|no idea|pata nahi|mujhe nahi pata|answer nahin pata)\b/.test(t)) return "unknown";
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
      if (lastQuestion) await speak(lastQuestion);
      else await speak("Abhi repeat karne ke liye question nahi hai. Pehle apna topic batao.");
      return;
    }
    if (command === "unknown") {
      await askAI("I do not know the answer to the current question. Please explain the correct answer simply, then check my understanding.");
      return;
    }
    if (command === "next") {
      await askAI("Please move to the next oral question on the same topic. Ask only one question.");
      return;
    }
    if (command === "explain") {
      await askAI("Please explain the current question or concept in simple language with an easy example, then ask one short check question.");
      return;
    }
    if (command === "stop") {
      await stopSession(true);
      return;
    }
    if (command === "start") {
      if (!active) startSession();
      else await askAI("Let's continue our oral preparation. Ask the next question on the same topic.");
      return;
    }
    await askAI(heard);
  }

  function setupRecognition() {
    if (!Recognition) return false;
    recognizer = new Recognition();
    recognizer.lang = "en-IN";
    recognizer.continuous = true;
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;
    recognizer.onresult = event => {
      const result = event.results[event.results.length - 1];
      if (result && result.isFinal && result[0]) handleSpeech(result[0].transcript);
    };
    recognizer.onerror = event => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        status("Microphone permission is blocked. Allow it in your browser settings.");
        shouldListen = false;
        caption("MICROPHONE PERMISSION NEEDED");
      } else if (event.error === "no-speech") {
        status("I didn't hear you. Speak when you're ready.");
      } else if (event.error !== "aborted") {
        status("Voice input issue: " + event.error);
      }
    };
    recognizer.onend = () => {
      if (active && shouldListen && !speaking && !busy) queueListen();
    };
    return true;
  }

  async function startSession() {
    if (!Recognition) {
      status("Voice recognition isn't supported in this browser. Try current Google Chrome.");
      return;
    }
    if (active) {
      shouldListen = true;
      listen();
      return;
    }
    if (!recognizer && !setupRecognition()) return;
    active = true;
    shouldListen = true;
    ui.mic.classList.add("listening");
    ui.pause.innerHTML = "<span>Ⅱ</span> Pause";
    status("Voice session started.");
    showAssistant("Hey! I'm NavAI. What subject or topic would you like to prepare today?");
    await speak("Hey! I'm NavAI. What subject or topic would you like to prepare today?");
  }

  async function stopSession(sayGoodbye) {
    active = false;
    shouldListen = false;
    busy = false;
    clearTimeout(restartTimer);
    stopRecognition();
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }
    speaking = false;
    ui.mic.classList.remove("listening", "speaking");
    caption("TAP TO START TALKING");
    ui.connection.lastChild.textContent = " READY";
    status("Voice session paused. Tap the microphone to continue.");
    if (sayGoodbye) {
      showAssistant("Session paused. Tap the microphone whenever you're ready to continue.");
    }
  }

  ui.mic.addEventListener("click", () => {
    if (active) {
      shouldListen = true;
      if (!speaking && !busy) listen();
      status("I'm here. Go ahead and speak.");
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
    if (document.hidden && active) status("Session may pause in the background. Keep the page open for hands-free voice.");
  });

  window.addEventListener("beforeunload", () => {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    if (recognizer) { try { recognizer.stop(); } catch (_) {} }
  });

  if (!Recognition) {
    status("For voice mode, open this page in a supported browser such as current Chrome.");
  } else {
    status("Tap the microphone to start your voice conversation.");
  }
})();

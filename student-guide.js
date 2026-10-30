(() => {
  const $ = id => document.getElementById(id);
  const messages = $("messages");
  const input = $("messageInput");
  const sendBtn = $("sendBtn");
  const voiceBtn = $("voiceBtn");
  const status = $("status");
  const language = $("language");
  const speakToggle = $("speakToggle");
  let readReplies = true;
  let listening = false;
  let busy = false;
  let recognition = null;
  let lastReply = "";

  const languageNames = {hinglish:"Hinglish (Hindi-English mix)",en:"English",hi:"Hindi"};
  function addMessage(text, who, label) {
    const box = document.createElement("div");
    box.className = "message " + who;
    const tag = document.createElement("span");
    tag.className = "speaker";
    tag.textContent = label;
    const p = document.createElement("p");
    p.textContent = text;
    box.append(tag, p);
    messages.appendChild(box);
    messages.scrollTop = messages.scrollHeight;
    return box;
  }
  function setBusy(value) {
    busy = value;
    sendBtn.disabled = value;
    input.disabled = value;
    status.textContent = value ? "Your guide is thinking…" : "You choose when to use your microphone.";
  }
  function speechLanguage() {
    return language.value === "hi" ? "hi-IN" : language.value === "en" ? "en-IN" : "hi-IN";
  }
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLanguage();
    utterance.rate = 0.96;
    window.speechSynthesis.speak(utterance);
  }
  function guidePrompt(userText) {
    const selected = languageNames[language.value] || "Hinglish";
    const history = Array.from(messages.querySelectorAll(".message"))
      .filter(el => !el.classList.contains("pending"))
      .slice(-12)
      .map(el => (el.innerText || "").trim())
      .filter(Boolean)
      .join("\n");

    return [
      "IDENTITY: You are NavAI Student Guide, an AI mentor for a school student.",
      "PURPOSE: Understand the student's real situation and help them make progress, not merely give generic motivation.",
      "LANGUAGE: Reply in " + selected + ". If the student naturally uses Hinglish, use simple natural Hinglish. Do not switch language unnecessarily.",
      "CONTEXT: Use the recent conversation below to understand follow-ups. Do not ask for information the student has already provided.",
      "RESPONSE QUALITY:",
      "- Answer the actual question first. Be clear, specific, practical and conversational.",
      "- For study questions, explain at the student's level and give a small worked example when useful.",
      "- For exam preparation, help prioritize topics and create realistic next steps; never promise marks or guaranteed results.",
      "- For time management, account for the student's stated schedule, school, breaks and sleep. Do not assume missing details.",
      "- For confidence, stress or setbacks, acknowledge the problem without lecturing, then suggest one or two manageable actions.",
      "- For choices, compare the realistic pros and cons and explain which option fits the stated goal best.",
      "- If the student says earlier advice did not work, acknowledge that and offer a meaningfully different approach.",
      "- Ask at most one focused follow-up question, only when the missing information matters.",
      "- Avoid repeated introductions, long disclaimers, empty praise, robotic templates and repeating the student's entire message.",
      "SAFETY: Be age-appropriate. Do not encourage cheating or dangerous actions. For serious safety or health concerns, encourage help from a trusted adult or qualified professional. Do not claim to be a human or a real parent, teacher or therapist.",
      "DEFAULT LENGTH: Keep every normal reply SHORT, SIMPLE and DIRECT. Usually use 1-3 short sentences.",
      "Answer the exact question first. Do not add unnecessary background, long introductions, repeated summaries, multiple headings or lengthy bullet lists.",
      "Use very simple, easy-to-understand language. Prefer everyday words and short sentences.",
      "For advice, give only 1-3 practical steps unless more are truly necessary.",
      "For school questions, answer simply and clearly; explain more only if the student asks.",
      "Give a long, detailed, step-by-step or full explanation ONLY when the student explicitly requests detail.",
      "If the student says 'short', 'simple', 'brief' or similar, keep the reply especially concise.",
      "Do not make answers so short that important meaning or safety information is lost.",
      "RECENT CONVERSATION:\n" + (history || "(No earlier conversation available)"),
      "LATEST STUDENT MESSAGE:\n" + userText
    ].join("\n\n");
  }
  function extractReply(data) {
    if (typeof data === "string") return data;
    if (!data || typeof data !== "object") return "";
    return data.reply || data.response || data.answer || data.message ||
      data.output || data.content ||
      (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  }
  async function sendMessage(raw) {
    const text = (raw || "").trim();
    if (!text || busy) return;
    addMessage(text, "user", "YOU");
    input.value = "";
    if (recognition && listening) {
      try { recognition.stop(); } catch (_) {}
    }
    setBusy(true);
    const pending = addMessage("Let me think this through with you…", "guide", "YOUR GUIDE");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({message: guidePrompt(text), mode:"student-guide"})
      });
      const rawBody = await response.text();
      let data;
      try { data = JSON.parse(rawBody); } catch (_) { data = rawBody; }
      if (!response.ok) {
        const detail = data && typeof data === "object" ? (data.error || data.message) : "";
        throw new Error(detail || "Server returned " + response.status);
      }
      const reply = extractReply(data);
      if (!reply || typeof reply !== "string") {
        throw new Error("The response format was not recognized.");
      }
      pending.querySelector("p").textContent = reply;
      lastReply = reply;
      messages.scrollTop = messages.scrollHeight;
      const readButton = document.createElement("button");
      readButton.type = "button";
      readButton.className = "reply-speak-btn";
      readButton.textContent = "🔊 सुनें";
      readButton.setAttribute("aria-label", "Student Guide ka jawab sunen");
      readButton.addEventListener("click", () => speak(reply));
      pending.appendChild(readButton);
      status.textContent = "Reply ready. You can type or tap the microphone again.";
    } catch (error) {
      pending.querySelector("p").textContent =
        "I couldn't reach the guide right now. Check your connection and try again. (" + (error.message || "Request failed") + ")";
      status.textContent = "Couldn't get a reply. Please try again.";
    } finally {
      setBusy(false);
      input.focus();
    }
  }
  sendBtn.addEventListener("click", () => sendMessage(input.value));
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input.value);
    }
  });
  $("quickPrompts").addEventListener("click", event => {
    const button = event.target.closest("button[data-prompt]");
    if (button) sendMessage(button.dataset.prompt);
  });
  speakToggle.addEventListener("click", () => {
    readReplies = !readReplies;
    speakToggle.textContent = readReplies ? "🔊 Read replies: on" : "🔇 Read replies: off";
    speakToggle.setAttribute("aria-pressed", String(readReplies));
    if (!readReplies && "speechSynthesis" in window) window.speechSynthesis.cancel();
  });
  language.addEventListener("change", () => {
    status.textContent = "Language set to " + languageNames[language.value] + ".";
  });

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceBtn.title = "Voice input is not supported in this browser";
    voiceBtn.addEventListener("click", () => {
      status.textContent = "Voice input isn't supported here. Try Chrome or type your message.";
    });
  } else {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      listening = true;
      voiceBtn.classList.add("listening");
      voiceBtn.textContent = "🎙️";
      status.textContent = "Listening… speak now.";
    };
    recognition.onresult = event => {
      const transcript = event.results && event.results[0] && event.results[0][0]
        ? event.results[0][0].transcript : "";
      if (transcript.trim()) {
        input.value = transcript.trim();
        status.textContent = "Heard you. Sending your question…";
        sendMessage(transcript);
      } else {
        status.textContent = "I didn't catch that. Tap the microphone and try again.";
      }
    };
    recognition.onerror = event => {
      status.textContent = event.error === "not-allowed"
        ? "Microphone permission was blocked. Allow microphone access in your browser."
        : "Voice input stopped (" + event.error + "). You can type instead.";
    };
    recognition.onend = () => {
      listening = false;
      voiceBtn.classList.remove("listening");
      voiceBtn.textContent = "🎤";
    };
    voiceBtn.addEventListener("click", () => {
      if (busy) return;
      if (listening) {
        recognition.stop();
        return;
      }
      try {
        recognition.lang = speechLanguage();
        recognition.start();
      } catch (_) {
        status.textContent = "Voice input is busy. Please try again in a moment.";
      }
    });
  }
})();

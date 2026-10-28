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
    if (!readReplies || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLanguage();
    utterance.rate = 0.96;
    window.speechSynthesis.speak(utterance);
  }
  function guidePrompt(userText) {
    const selected = languageNames[language.value];
    return [
      "You are NavAI Student Guide, a calm and practical mentor for a school student.",
      "Your style combines a good teacher's clear explanations, a caring parent's patience, and a helpful senior's practical perspective.",
      "Respond in " + selected + ". Match the student's language naturally.",
      "First understand the actual concern. Be warm but not preachy, judgmental, overconfident, or falsely reassuring.",
      "Give useful, age-appropriate, realistic steps. Ask at most one focused follow-up question when genuinely needed.",
      "For study issues, help make small achievable plans. For confidence or stress, listen first and break the problem into manageable next steps.",
      "Never shame the student, encourage cheating, or promise guaranteed results. Do not pretend to be a real parent, teacher, therapist, or human friend.",
      "For serious safety, abuse, health, or crisis concerns, encourage involving a trusted adult and appropriate professional help.",
      "Keep ordinary replies concise and conversational. Use clear steps only when they help.",
      "Student's message: " + userText
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
      speak(reply);
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
      voiceBtn.textContent = "■";
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
      voiceBtn.textContent = "🎙";
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
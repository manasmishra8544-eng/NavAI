const $ = id => document.getElementById(id);
const topicInput = $("topic"), board = $("board"), statusBox = $("status");

let lesson = null, activeStep = 0, history = [], busy = false;
let voiceParts = [], voiceIndex = 0, voiceToken = 0, voiceActive = false;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));

const textOf = value => typeof value === "string" ? value : "";

function parseLesson(raw, question) {
  let data;
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    data = JSON.parse(cleaned);
  } catch {
    data = {
      title: question,
      intro: raw,
      steps: [{ heading: "Explanation", explanation: raw }],
      takeaway: "Review the explanation and ask a follow-up question."
    };
  }

  if (!data || typeof data !== "object") data = {};
  if (!Array.isArray(data.steps) || !data.steps.length) {
    data.steps = [{ heading: "Explanation", explanation: textOf(data.intro) || raw }];
  }

  data.title = textOf(data.title) || question;
  data.intro = textOf(data.intro);
  data.steps = data.steps.slice(0, 8).map((s, i) => ({
    heading: textOf(s.heading) || `Step ${i + 1}`,
    explanation: textOf(s.explanation) || textOf(s.content),
    equation: textOf(s.equation)
  }));
  data.takeaway = textOf(data.takeaway);
  data.visuals = Array.isArray(data.visuals)
    ? data.visuals.filter(v => typeof v === "string").slice(0, 5)
    : [];
  return data;
}

function setStatus(message, mode = "") {
  statusBox.textContent = message;
  statusBox.className = "status" + (mode ? " " + mode : "");
}

function setBusy(value) {
  busy = value;
  $("teachBtn").disabled = value;
  $("teachBtn").textContent = value ? "Preparing lesson..." : "Teach me";
}

function setPicoSpeaking(value) {
  voiceActive = value;
  document.querySelector(".mascot-wrap")?.classList.toggle("is-speaking", value);
  $("speakBtn").textContent = value ? "Teaching aloud..." : "Start teaching aloud";
}

function stopVoice() {
  voiceToken++;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  voiceParts = [];
  voiceIndex = 0;
  setPicoSpeaking(false);
}

function renderLesson() {
  if (!lesson) return;

  const steps = lesson.steps;
  activeStep = Math.max(0, Math.min(activeStep, steps.length - 1));

  const stepCards = steps.map((s, i) => `
    <article class="lesson-step ${i === activeStep ? "active" : ""}"
      data-step="${i}" aria-current="${i === activeStep ? "step" : "false"}">
      <div class="step-number">${i + 1}</div>
      <div class="step-copy">
        <h4>${escapeHtml(s.heading)}</h4>
        <p>${escapeHtml(s.explanation)}</p>
        ${s.equation ? `<div class="equation">${escapeHtml(s.equation)}</div>` : ""}
      </div>
      ${i === activeStep ? '<span class="board-pen" aria-hidden="true"></span>' : ""}
    </article>`).join("");

  const concepts = (lesson.visuals.length
    ? lesson.visuals
    : steps.map(s => s.heading)).slice(0, 5);

  board.classList.remove("board-writing");
  board.innerHTML = `
    <div class="lesson-heading">
      <div>
        <h3>${escapeHtml(lesson.title)}</h3>
        <p>${escapeHtml(lesson.intro)}</p>
      </div>
      <span class="lesson-chip">LIVE TEACHING BOARD</span>
    </div>
    <div class="board-writing-label">
      <span class="board-live-dot"></span>
      BOARD EXPLANATION
      <span>Step ${activeStep + 1} / ${steps.length}</span>
    </div>
    <div class="lesson-grid">
      <div class="steps-list">${stepCards}</div>
      <aside class="visual-card">
        <h4>Lesson roadmap</h4>
        <div class="concept-list">
          ${concepts.map((c, i) => `
            <div class="concept ${i === activeStep ? "concept-current" : ""}">
              <span>${i + 1}.</span>${escapeHtml(c)}
            </div>`).join("")}
        </div>
        <div class="takeaway">
          <b>REMEMBER THIS</b>
          <p>${escapeHtml(lesson.takeaway || "Understand the idea first, then practise.")}</p>
        </div>
      </aside>
    </div>`;

  void board.offsetWidth;
  board.classList.add("board-writing");

  $("stepCounter").textContent = `Step ${activeStep + 1} of ${steps.length}`;
  $("prevBtn").disabled = activeStep === 0;
  $("nextBtn").disabled = activeStep === steps.length - 1;
  $("lessonActions").hidden = false;

  board.querySelectorAll("[data-step]").forEach(el => {
    el.addEventListener("click", () => {
      stopVoice();
      activeStep = Number(el.dataset.step);
      renderLesson();
      setStatus("Step selected. Press Start teaching aloud to hear the explanation.");
    });
  });
}

function makeVoiceParts() {
  const parts = [];

  if (lesson.title) parts.push({ text: lesson.title, step: -1 });
  if (lesson.intro) parts.push({ text: lesson.intro, step: -1 });

  lesson.steps.forEach((s, i) => {
    const text = [
      `Step ${i + 1}. ${s.heading}.`,
      s.explanation,
      s.equation ? `The equation is ${s.equation}.` : ""
    ].filter(Boolean).join(" ");

    parts.push({ text, step: i });
  });

  if (lesson.takeaway) {
    parts.push({ text: `Let's recap. ${lesson.takeaway}`, step: -1 });
  }

  return parts;
}

function speakNext(token) {
  if (token !== voiceToken || !voiceParts.length) return;

  if (voiceIndex >= voiceParts.length) {
    setPicoSpeaking(false);
    setStatus("Lesson finished! Ask Pico a follow-up or replay the explanation.");
    return;
  }

  const part = voiceParts[voiceIndex];
  const utterance = new SpeechSynthesisUtterance(part.text);
  const language = $("language").value;

  utterance.lang = language.includes("Hindi") || language.includes("Hinglish")
    ? "hi-IN" : "en-IN";
  utterance.rate = 0.92;
  utterance.pitch = 1.05;

  utterance.onstart = () => {
    if (token !== voiceToken) return;
    setPicoSpeaking(true);

    if (part.step >= 0) {
      activeStep = part.step;
      renderLesson();
      setStatus(`Pico is explaining step ${part.step + 1}: ${lesson.steps[part.step].heading}`);
    } else if (voiceIndex === 0) {
      setStatus("Pico is introducing the lesson...");
    } else {
      setStatus("Pico is reviewing the key idea...");
    }
  };

  utterance.onend = () => {
    if (token !== voiceToken) return;
    voiceIndex++;
    speakNext(token);
  };

  utterance.onerror = event => {
    if (token !== voiceToken || event.error === "canceled" || event.error === "interrupted") return;
    setPicoSpeaking(false);
    setStatus("Voice playback stopped. Try starting the lesson again.", "error");
  };

  window.speechSynthesis.speak(utterance);
}

function startTeaching() {
  if (!lesson) return;
  if (!("speechSynthesis" in window)) {
    setStatus("Voice playback is not supported by this browser.", "error");
    return;
  }

  stopVoice();
  voiceParts = makeVoiceParts();
  voiceIndex = 0;
  const token = voiceToken;
  setStatus("Pico is getting ready to teach...");
  speakNext(token);
}

async function teach(question, isFollowup = false) {
  if (busy) return;
  question = question.trim();
  if (!question) return;

  stopVoice();
  setBusy(true);
  setStatus("Pico is preparing your explanation. Please wait...", "loading");

  try {
    const response = await fetch("/api/classroom/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        level: $("level").value,
        language: $("language").value,
        history: history.slice(-6)
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not create the lesson.");

    const raw = textOf(result.lesson);
    if (!raw) throw new Error("The AI returned an empty lesson. Please try again.");

    lesson = parseLesson(raw, question);
    activeStep = 0;
    renderLesson();

    history.push(
      { role: "user", content: question },
      { role: "assistant", content: raw }
    );
    history = history.slice(-8);
    // NAVAI_PERSISTENT_TEACHER_HISTORY
    try {
      const key = "navai.teacher.history.v1";
      const items = JSON.parse(localStorage.getItem(key) || "[]");
      items.unshift({
        id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8),
        question: String(question || "Untitled lesson"),
        raw: String(raw || ""),
        conversation: history.slice(),
        updatedAt: Date.now()
      });
      localStorage.setItem(key, JSON.stringify(items.slice(0, 100)));
      window.dispatchEvent(new Event("navai:teacher-history-updated"));
    } catch (err) {
      console.error("NavAI Teacher history save failed:", err);
      setStatus("Lesson created, but history could not be saved in this browser.", "error");
    }

    setStatus("Pico is starting your step-by-step lesson...");

    if (isFollowup) $("followInput").value = "";
    startTeaching();
  } catch (error) {
    setStatus(error.message || "Something went wrong. Please try again.", "error");
  } finally {
    setBusy(false);
  }
}

$("lessonForm").addEventListener("submit", e => {
  e.preventDefault();
  history = [];
  teach(topicInput.value);
});

$("followForm").addEventListener("submit", e => {
  e.preventDefault();
  if (!lesson) {
    setStatus("Start by choosing a topic above first.");
    return;
  }
  teach($("followInput").value, true);
});

document.querySelectorAll("[data-topic]").forEach(button => {
  button.addEventListener("click", () => {
    topicInput.value = button.dataset.topic;
    topicInput.focus();
  });
});

$("prevBtn").addEventListener("click", () => {
  if (activeStep > 0) {
    stopVoice();
    activeStep--;
    renderLesson();
  }
});

$("nextBtn").addEventListener("click", () => {
  if (lesson && activeStep < lesson.steps.length - 1) {
    stopVoice();
    activeStep++;
    renderLesson();
  }
});

$("speakBtn").addEventListener("click", () => {
  if ("speechSynthesis" in window && window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    setPicoSpeaking(true);
    return;
  }
  startTeaching();
});

$("pauseBtn").addEventListener("click", () => {
  if (!("speechSynthesis" in window)) return;

  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    setPicoSpeaking(true);
    setStatus("Pico has resumed teaching.");
  } else if (window.speechSynthesis.speaking) {
    window.speechSynthesis.pause();
    setPicoSpeaking(false);
    setStatus("Pico is paused. Press Pause voice again to resume.");
  }
});

$("stopBtn").addEventListener("click", () => {
  stopVoice();
  setStatus("Voice stopped. You can restart the lesson whenever you're ready.");
});

window.addEventListener("beforeunload", stopVoice);
$("speakBtn").textContent = "Start teaching aloud";
// NAVAI_TEACHER_HISTORY_V1
(() => {
  const KEY = "navai.teacher.history.v1";
  let currentSavedLessonId = null;
  const readSaved = () => {
    try { const value = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(value) ? value : []; }
    catch { return []; }
  };
  const writeSaved = items => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); return true; }
    catch { setStatus("History could not be saved. Browser storage may be full.", "error"); return false; }
  };
  const escSaved = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const historyPanel = document.createElement("section");
  historyPanel.id = "navai-teacher-history";
  historyPanel.innerHTML = `
    <style>
      #navai-teacher-history{margin:18px 0;padding:18px;border:1px solid rgba(145,170,255,.22);border-radius:18px;background:rgba(9,17,35,.9);color:#eaf0ff}
      #navai-teacher-history .nth-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
      #navai-teacher-history h2{font-size:18px;margin:0} #navai-teacher-history p{font-size:12px;color:#aab9d7;margin:6px 0 0}
      #navai-teacher-history button{border:1px solid rgba(145,170,255,.3);border-radius:10px;background:#152544;color:#eaf0ff;padding:9px 12px;cursor:pointer}
      #navai-teacher-history .nth-list{display:grid;gap:8px;margin-top:14px}
      #navai-teacher-history .nth-item{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid rgba(145,170,255,.16);border-radius:12px;padding:11px}
      #navai-teacher-history .nth-title{font-size:13px;overflow-wrap:anywhere} #navai-teacher-history .nth-date{font-size:11px;color:#aab9d7;margin-top:4px}
      #navai-teacher-history .nth-actions{display:flex;gap:7px;flex-shrink:0}
      #navai-teacher-history .nth-empty{font-size:13px;color:#aab9d7;padding:12px 0}
      @media(max-width:560px){#navai-teacher-history .nth-item{align-items:flex-start;flex-direction:column}#navai-teacher-history .nth-actions{flex-wrap:wrap}}
    </style>
    <div class="nth-head"><div><h2>Lesson history</h2><p>Lessons and your current step are saved automatically in this browser.</p></div><button type="button" id="nth-clear">Clear history</button></div>
    <div class="nth-list" id="nth-list"></div>`;
  const host = document.querySelector(".layout") || document.body;
  const boardSection = document.querySelector(".board-section");
  if (boardSection) host.insertBefore(historyPanel, boardSection);
  else host.appendChild(historyPanel);
  const list = document.getElementById("nth-list");

  function renderSavedList() {
    const items = readSaved().sort((a,b) => b.updatedAt - a.updatedAt);
    if (!items.length) { list.innerHTML = '<div class="nth-empty">No lessons saved yet. Ask Pico to teach a topic.</div>'; return; }
    list.innerHTML = items.map(item => `
      <div class="nth-item">
        <div><div class="nth-title">${escSaved(item.title || item.question || "Untitled lesson")}</div><div class="nth-date">${escSaved(new Date(item.updatedAt).toLocaleString())} · Step ${(Number(item.activeStep)||0)+1}</div></div>
        <div class="nth-actions"><button type="button" data-nth-open="${escSaved(item.id)}">Open</button><button type="button" data-nth-delete="${escSaved(item.id)}">Delete</button></div>
      </div>`).join("");
  }
  function saveCurrentLesson(question, raw, isFollowup) {
    if (!lesson) return;
    const items = readSaved();
    let item = isFollowup && currentSavedLessonId ? items.find(x => x.id === currentSavedLessonId) : null;
    if (!item) {
      item = {id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, question, title: lesson.title || question, createdAt: Date.now()};
      items.push(item);
      currentSavedLessonId = item.id;
    }
    item.question = item.question || question;
    item.title = lesson.title || item.question;
    item.lesson = lesson;
    item.chatHistory = history;
    item.activeStep = activeStep;
    item.updatedAt = Date.now();
    writeSaved(items);
    renderSavedList();
  }
  function saveStep() {
    if (!currentSavedLessonId || !lesson) return;
    const items = readSaved();
    const item = items.find(x => x.id === currentSavedLessonId);
    if (!item) return;
    item.lesson = lesson;
    item.chatHistory = history;
    item.activeStep = activeStep;
    item.updatedAt = Date.now();
    writeSaved(items);
    renderSavedList();
  }
  list.addEventListener("click", event => {
    const openButton = event.target.closest("[data-nth-open]");
    const deleteButton = event.target.closest("[data-nth-delete]");
    if (openButton) {
      const item = readSaved().find(x => x.id === openButton.dataset.nthOpen);
      if (!item || !item.lesson) return;
      stopVoice();
      currentSavedLessonId = item.id;
      lesson = item.lesson;
      activeStep = Math.max(0, Math.min(Number(item.activeStep) || 0, lesson.steps.length - 1));
      history = Array.isArray(item.chatHistory) ? item.chatHistory : [];
      topicInput.value = item.question || item.title || "";
      renderLesson();
      setStatus("Saved lesson restored. Continue from where you left off.", "success");
      document.querySelector(".board-section")?.scrollIntoView({behavior:"smooth",block:"start"});
    }
    if (deleteButton) {
      if (!confirm("Delete this saved lesson?")) return;
      if (currentSavedLessonId === deleteButton.dataset.nthDelete) currentSavedLessonId = null;
      writeSaved(readSaved().filter(x => x.id !== deleteButton.dataset.nthDelete));
      renderSavedList();
    }
  });
  document.getElementById("nth-clear").addEventListener("click", () => {
    if (!readSaved().length) return;
    if (confirm("Delete all NavAI Teacher lesson history? This cannot be undone.")) {
      writeSaved([]);
      currentSavedLessonId = null;
      renderSavedList();
    }
  });

  // Hook into the existing lesson flow without changing the AI request/response.
  const originalTeach = teach;
  teach = async function(question, isFollowup = false) {
    const previousId = currentSavedLessonId;
    const previousLesson = lesson;
    await originalTeach(question, isFollowup);
    if (lesson && lesson !== previousLesson) {
      // A new topic creates a new saved lesson; follow-ups update that lesson.
      if (!isFollowup) currentSavedLessonId = null;
      saveCurrentLesson(question, "", isFollowup);
    } else {
      currentSavedLessonId = previousId;
    }
  };

  // Existing step handlers run first; these listeners persist the updated step afterward.
  document.getElementById("prevBtn")?.addEventListener("click", saveStep);
  document.getElementById("nextBtn")?.addEventListener("click", saveStep);

  renderSavedList();
})();

// NAVAI_PERSISTENT_TEACHER_RESTORE
window.addEventListener("navai:restore-lesson", event => {
  const item = event.detail;
  if (!item || typeof item.raw !== "string") return;
  lesson = parseLesson(item.raw, item.question || "Saved lesson");
  activeStep = 0;
  history = Array.isArray(item.conversation) ? item.conversation.slice(-8) : [];
  renderLesson();
  setStatus("Saved lesson restored. Continue learning!");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// NAVAI_VOICE_QUESTION_AUTO_ANSWER_V1
// Voice question -> automatic lesson/answer -> spoken response.
(() => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  function addVoiceQuestion(inputId, label, isFollowup) {
    const input = document.getElementById(inputId);
    if (!input || !input.parentNode) return;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "🎙️ Ask by voice";
    button.setAttribute("aria-label", label + " using voice");
    button.style.cssText =
      "margin:8px 0;padding:10px 15px;border:1px solid #647cf5;" +
      "border-radius:12px;background:#17264a;color:#fff;" +
      "cursor:pointer;font-weight:600;";

    input.insertAdjacentElement("afterend", button);

    if (!SpeechRecognition) {
      button.title = "Voice recognition is not supported in this browser.";
      button.addEventListener("click", () => {
        setStatus(
          "Voice recognition is unavailable in this browser. Try updated Chrome.",
          "error"
        );
      });
      return;
    }

    let listening = false;
    let recognition = null;

    button.addEventListener("click", () => {
      if (listening) {
        recognition?.stop();
        return;
      }

      if (isFollowup && !lesson) {
        setStatus("Pehle Pico se ek lesson start karo.");
        return;
      }

      recognition = new SpeechRecognition();
      recognition.lang = /hindi|hinglish/i.test(
        document.getElementById("language")?.value || ""
      ) ? "hi-IN" : "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      listening = true;
      button.textContent = "🔴 Listening... (click to stop)";
      setStatus("Pico sun raha hai. Apna question bolo...");

      recognition.onresult = event => {
        const question = event.results?.[0]?.[0]?.transcript?.trim();
        if (!question) {
          setStatus("Question samajh nahi aaya. Dobara try karo.", "error");
          return;
        }

        input.value = question;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        setStatus("Tumhara question: " + question);

        if (isFollowup) {
          teach(question, true);
        } else {
          history = [];
          teach(question, false);
        }
      };

      recognition.onerror = event => {
        if (event.error === "not-allowed" ||
            event.error === "service-not-allowed") {
          setStatus(
            "Microphone permission allow karo, phir dobara try karo.",
            "error"
          );
        } else if (event.error !== "aborted" &&
                   event.error !== "no-speech") {
          setStatus("Voice input error: " + event.error, "error");
        } else if (event.error === "no-speech") {
          setStatus("Koi question sunai nahi diya. Dobara bolo.", "error");
        }
      };

      recognition.onend = () => {
        listening = false;
        button.textContent = "🎙️ Ask by voice";
      };

      try {
        recognition.start();
      } catch (error) {
        listening = false;
        button.textContent = "🎙️ Ask by voice";
        setStatus("Mic restart nahi ho saka. Dobara try karo.", "error");
      }
    });
  }

  addVoiceQuestion("topic", "Ask a topic", false);
  addVoiceQuestion("followInput", "Ask a follow-up", true);
})();

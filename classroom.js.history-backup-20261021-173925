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
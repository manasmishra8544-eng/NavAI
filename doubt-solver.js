(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "navai.doubtSolver.history.v1";
  let currentAnswer = "";
  let currentQuestion = "";

  function getHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }

  function setStatus(message) { $("status").textContent = message; }

  function renderHistory() {
    const host = $("history");
    const items = getHistory();
    host.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-history";
      empty.textContent = "No saved doubts yet. Your saved explanations will appear here.";
      host.appendChild(empty);
      return;
    }
    items.slice(0, 10).forEach((item) => {
      const row = document.createElement("div");
      row.className = "history-item";
      const info = document.createElement("div");
      const question = document.createElement("div");
      question.className = "history-question";
      question.textContent = item.question;
      const meta = document.createElement("div");
      meta.className = "history-meta";
      meta.textContent = `${item.subject || "General"} · ${item.level || "Student"} · ${item.date || ""}`;
      info.append(question, meta);
      const open = document.createElement("button");
      open.className = "history-open";
      open.textContent = "Open";
      open.addEventListener("click", () => {
        currentQuestion = item.question;
        currentAnswer = item.answer;
        $("question").value = item.question;
        $("subject").value = item.subject || "General";
        $("level").value = item.level || "Class 9";
        showAnswer(item.answer);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      row.append(info, open);
      host.appendChild(row);
    });
  }

  function showAnswer(answer) {
    currentAnswer = answer;
    $("answer").textContent = answer;
    $("answer-panel").hidden = false;
  }

  $("question").addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") solve();
  });

  document.querySelectorAll(".suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      $("question").value = button.dataset.prompt + $("question").value.trim();
      $("question").focus();
    });
  });

  async function solve() {
    const question = $("question").value.trim();
    if (!question) {
      setStatus("Pehle apna doubt type karo.");
      $("question").focus();
      return;
    }
    currentQuestion = question;
    const subject = $("subject").value;
    const level = $("level").value;
    const button = $("solve");
    button.disabled = true;
    button.textContent = "Solving your doubt…";
    setStatus("NavAI se explanation li ja rahi hai…");

    const message = `You are NavAI Doubt Solver, a patient tutor. Help a ${level} student with a ${subject} question. Explain in clear, simple language. Give a step-by-step solution when appropriate, explain why the steps work, and finish with a short final answer or takeaway. If the question is ambiguous, state your assumption. Do not invent facts.\n\nStudent's doubt:\n${question}`;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: [] })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.message || `Request failed (${response.status})`);
      }
      let answer = data.response || data.answer || data.reply || data.content ||
        data.choices?.[0]?.message?.content ||
        data.data?.response || data.data?.answer;
      if (typeof answer !== "string" || !answer.trim()) {
        throw new Error("API se answer nahi mila. Server response format check karna hoga.");
      }
      showAnswer(answer.trim());
      setStatus("Explanation ready. Agar useful ho, Save doubt dabao.");
      $("answer-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setStatus(`Doubt solve nahi hua: ${error.message}. Internet/API connection check karo.`);
    } finally {
      button.disabled = false;
      button.innerHTML = '<span>✦</span> Solve my doubt <span class="arrow">→</span>';
    }
  }

  $("solve").addEventListener("click", solve);

  $("copy").addEventListener("click", async () => {
    if (!currentAnswer) return setStatus("Copy karne ke liye pehle answer lo.");
    try {
      await navigator.clipboard.writeText(currentAnswer);
      setStatus("Answer copied!");
    } catch (_) {
      const area = document.createElement("textarea");
      area.value = currentAnswer;
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      setStatus(ok ? "Answer copied!" : "Copy nahi hua. Answer select karke copy karo.");
    }
  });

  $("save").addEventListener("click", () => {
    if (!currentQuestion || !currentAnswer) return setStatus("Pehle doubt solve karo.");
    const items = getHistory();
    const existing = items.findIndex((item) => item.question === currentQuestion);
    const record = {
      question: currentQuestion,
      answer: currentAnswer,
      subject: $("subject").value,
      level: $("level").value,
      date: new Date().toLocaleString()
    };
    if (existing >= 0) items.splice(existing, 1);
    items.unshift(record);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 30)));
      renderHistory();
      setStatus("Doubt is browser mein save ho gaya.");
    } catch (_) {
      setStatus("Browser storage full ho sakti hai. Purani history clear karke try karo.");
    }
  });

  $("clear-history").addEventListener("click", () => {
    if (!getHistory().length) return setStatus("History pehle se empty hai.");
    if (confirm("Is browser se saved doubt history clear kar dein?")) {
      localStorage.removeItem(STORAGE_KEY);
      renderHistory();
      setStatus("Saved history clear ho gayi.");
    }
  });

  renderHistory();
})();
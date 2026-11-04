const $ = id => document.getElementById(id);
const HISTORY_KEY = "navai_homework_history_v1";
const question = $("question");
const photo = $("photo");
const status = $("status");
const solve = $("solve");
let imageData = "";

function getHistory() {
  try {
    const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function renderHistory() {
  const list = $("historyList");
  if (!list) return;
  const items = getHistory();
  list.replaceChildren();
  $("historyCount").textContent = `${items.length} saved answer${items.length === 1 ? "" : "s"}`;

  if (!items.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Your solved questions will appear here automatically.";
    list.appendChild(p);
    return;
  }

  items.forEach(item => {
    const card = document.createElement("article");
    card.className = "history-item";

    const title = document.createElement("div");
    title.className = "history-title";
    title.textContent = `${item.subject} · ${new Date(item.date).toLocaleString()}`;

    const q = document.createElement("p");
    q.className = "history-question";
    q.textContent = item.question || "Photo question";

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const open = document.createElement("button");
    open.className = "secondary";
    open.textContent = "Open";
    open.onclick = () => {
      $("answerTitle").textContent = item.subject + " · Answer";
      $("answer").textContent = item.answer;
      $("result").hidden = false;
      $("result").scrollIntoView({ behavior: "smooth" });
    };

    const copy = document.createElement("button");
    copy.className = "secondary";
    copy.textContent = "Copy";
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(item.answer);
        copy.textContent = "Copied!";
      } catch { status.textContent = "Copy failed. Open the answer and try again."; }
      setTimeout(() => copy.textContent = "Copy", 1200);
    };

    const del = document.createElement("button");
    del.className = "remove";
    del.textContent = "Delete";
    del.onclick = () => {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(getHistory().filter(x => x.id !== item.id)));
      renderHistory();
    };

    actions.append(open, copy, del);
    card.append(title, q, actions);
    list.appendChild(card);
  });
}

$("uploadBtn").addEventListener("click", () => photo.click());

photo.addEventListener("change", () => {
  const file = photo.files && photo.files[0];
  if (!file) return;

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    status.textContent = "Choose a JPG, PNG or WebP image.";
    photo.value = "";
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    status.textContent = "Image must be smaller than 4 MB.";
    photo.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    imageData = String(reader.result || "");
    $("preview").src = imageData;
    $("preview").hidden = false;
    $("fileName").textContent = file.name;
    $("removePhoto").hidden = false;
    status.textContent = "";
  };
  reader.onerror = () => status.textContent = "Could not read the image.";
  reader.readAsDataURL(file);
});

$("removePhoto").addEventListener("click", () => {
  imageData = "";
  photo.value = "";
  $("preview").removeAttribute("src");
  $("preview").hidden = true;
  $("fileName").textContent = "No photo selected";
  $("removePhoto").hidden = true;
});

solve.addEventListener("click", async () => {
  const q = question.value.trim();
  if (!q && !imageData) {
    status.textContent = "Type a question or upload a photo first.";
    return;
  }

  solve.disabled = true;
  solve.textContent = "Solving...";
  status.textContent = "Preparing your notebook-ready answer...";

  try {
    const response = await fetch("/api/homework/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: q,
        subject: $("subject").value,
        style: $("style").value,
        image: imageData
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not solve this question.");
    if (!data.answer || !data.answer.trim()) throw new Error("Empty answer returned. Please try again.");

    const answer = data.answer.trim();
    const subject = $("subject").value;
    $("answerTitle").textContent = subject + " · Answer";
    $("answer").textContent = answer;
    $("result").hidden = false;

    const history = getHistory();
    const key = (subject + "|" + (q || "Photo question")).toLowerCase().replace(/\s+/g, " ").trim();
    const oldIndex = history.findIndex(x => x.key === key);
    const item = {
      id: oldIndex >= 0 ? history[oldIndex].id : Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      key,
      subject,
      question: q || "Photo question",
      answer,
      date: new Date().toISOString()
    };

    if (oldIndex >= 0) history.splice(oldIndex, 1);
    history.unshift(item);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
    renderHistory();
    status.textContent = "Answer ready and saved to history.";
    $("result").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    status.textContent = error.message || "Request failed. Please try again.";
  } finally {
    solve.disabled = false;
    solve.innerHTML = 'Solve homework <span>?</span>';
  }
});

$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("answer").textContent);
    $("copy").textContent = "Copied!";
  } catch {
    const area = document.createElement("textarea");
    area.value = $("answer").textContent;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    $("copy").textContent = "Copied!";
  }
  setTimeout(() => $("copy").textContent = "Copy answer", 1400);
});

$("clearHistory").addEventListener("click", () => {
  if (!getHistory().length) return;
  if (confirm("Delete all saved homework answers from this browser?")) {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  }
});

renderHistory();

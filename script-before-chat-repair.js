
const $ = (id) => document.getElementById(id);

const form = $("chatForm");
const input = $("messageInput");
const messagesEl = $("messages");
const welcome = $("welcome");
const statusEl = $("status");
const sendBtn = $("sendBtn");
const historyList = $("historyList");

const STORAGE_KEY = "navai_chats_v2";
const THEME_KEY = "navai_theme";
let chats = loadChats();
let currentChatId = null;
let busy = false;

function loadChats() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveChats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function getCurrentChat() {
  return chats.find((chat) => chat.id === currentChatId);
}

function createChat(mode = "normal") {
  const chat = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: "New chat",
    mode,
    messages: []
  };
  chats.unshift(chat);
  currentChatId = chat.id;
  saveChats();
  renderHistory();
  renderMessages();
}

function ensureChat() {
  if (!getCurrentChat()) createChat();
  return getCurrentChat();
}

function renderHistory() {
  historyList.replaceChildren();

  chats.forEach((chat) => {
    const button = document.createElement("button");
    button.className = "history-item" + (chat.id === currentChatId ? " active" : "");
    button.textContent = chat.title || "New chat";
    button.title = button.textContent;
    button.addEventListener("click", () => {
      currentChatId = chat.id;
      renderHistory();
      renderMessages();
      $("sidebar").classList.remove("open");
    });
    historyList.appendChild(button);
  });
}

function addMessage(role, content) {
  const row = document.createElement("div");
  row.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "Y" : "N";

  const bubble = document.createElement("div");
  bubble.className = "message-content";
  bubble.textContent = content;

  row.append(avatar, bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollIntoView({ block: "end", behavior: "smooth" });
  return bubble;
}

function renderMessages() {
  messagesEl.replaceChildren();
  statusEl.textContent = "";

  const chat = getCurrentChat();
  const hasMessages = Boolean(chat && chat.messages.length);
  welcome.hidden = hasMessages;

  if (chat) {
    chat.messages.forEach((message) => {
      addMessage(message.role, message.content);
    });
  }
}

function setBusy(value) {
  busy = value;
  sendBtn.disabled = value;
  input.disabled = value;
  sendBtn.textContent = value ? "â€¦" : "â†‘";
}

async function sendMessage(text) {
  if (busy || !text.trim()) return;

  const chat = ensureChat();
  const userText = text.trim();

  chat.messages.push({ role: "user", content: userText });
  if (chat.title === "New chat") {
    chat.title = userText.slice(0, 38) + (userText.length > 38 ? "â€¦" : "");
  }

  saveChats();
  input.value = "";
  resizeInput();
  renderHistory();
  renderMessages();
  addMessage("user", userText);

  const thinking = addMessage("assistant", "Thinkingâ€¦");
  statusEl.textContent = "Connecting to NavAIâ€¦";
  setBusy(true);

  try {
    const history = chat.messages.slice(0, -1).slice(-12).map((item) => ({
      role: item.role,
      content: item.content
    }));

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText, history, study: chat.mode === "study" })
    });

    const raw = await response.text();
    let result;

    try {
      result = JSON.parse(raw);
    } catch {
      throw new Error(
        `Server se valid JSON nahi aaya (HTTP ${response.status}). ` +
        "Server restart karo aur VS Code terminal check karo."
      );
    }

    if (!response.ok) {
      throw new Error(result.error || `Request failed (HTTP ${response.status}).`);
    }

    const answer = result.response || result.answer || result.reply;
    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error("AI ka reply empty hai. Dobara try karo.");
    }

    thinking.textContent = answer;
    chat.messages.push({ role: "assistant", content: answer });
    saveChats();
    statusEl.textContent = "";
  } catch (error) {
    thinking.textContent = `Sorry, ${error.message || "kuch problem hui."}`;
    statusEl.textContent = "Reply nahi aaya. Error message upar dekho.";
    console.error("NavAI chat error:", error);
  } finally {
    setBusy(false);
    input.focus();
  }
}

function resizeInput() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(input.value);
});

input.addEventListener("input", resizeInput);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

window.addEventListener("navai:study", () => {
  if (busy) return;
  createChat("study");
  input.placeholder = "Message Study...";
  input.setAttribute("aria-label", "Message Study");
  input.focus();
});
$("newChatBtn").addEventListener("click", () => {
  if (busy) return;
  createChat();
  input.focus();
});

$("clearBtn").addEventListener("click", () => {
  if (busy) return;
  createChat();
  input.focus();
});

$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

$("themeBtn").addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "light" ? "dark" : "light";
  document.body.dataset.theme = nextTheme;
  localStorage.setItem(THEME_KEY, nextTheme);
});

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt || "";
    resizeInput();
    input.focus();
  });
});

const savedTheme = localStorage.getItem(THEME_KEY);
document.body.dataset.theme = savedTheme === "light" ? "light" : "dark";

renderHistory();

if (chats.length) {
  currentChatId = chats[0].id;
  renderHistory();
  renderMessages();
} else {
  welcome.hidden = false;
  messagesEl.replaceChildren();
}


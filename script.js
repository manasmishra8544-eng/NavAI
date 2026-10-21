
const STORAGE_KEY = "navai_chat_history";
const THEME_KEY = "navai_theme";

const $ = (id) => document.getElementById(id);

const chatForm = $("chatForm");
const messageInput = $("messageInput");
const sendBtn = $("sendBtn");
const attachBtn = $("attachBtn");
const imageInput = $("imageInput");
const imagePreviewContainer = $("imagePreviewContainer");
const imagePreview = $("imagePreview");
const imageFileName = $("imageFileName");
const removeImageBtn = $("removeImageBtn");
const welcomeScreen = $("welcomeScreen");
const conversation = $("conversation");
const messages = $("messages");
const chatHistory = $("chatHistory");

let chats = loadChats();
let activeChatId = null;
let currentImage = null;
let currentImageName = "";
let isSending = false;
let toastTimer = null;

/* STORAGE */

function loadChats() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        const source = Array.isArray(saved) ? saved : saved.chats || saved.sessions || [];

        return source.map((chat, index) => ({
            id: String(chat.id || `chat-${index}-${Date.now()}`),
            title: String(chat.title || "New chat"),
            updatedAt: Number(chat.updatedAt || chat.createdAt || Date.now()),
            messages: (Array.isArray(chat.messages) ? chat.messages : [])
                .filter(m => m && ["user", "assistant"].includes(m.role))
                .map(m => ({
                    role: m.role,
                    content: String(m.content ?? m.text ?? ""),
                    image: typeof m.image === "string" && m.image.startsWith("data:image/") ? m.image : null,
                    time: m.time || m.timestamp || Date.now()
                }))
        })).sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
        console.error("Chat history could not be loaded:", error);
        return [];
    }
}

function saveChats() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
        if (window.NAVAI_CHAT_SYNC) window.NAVAI_CHAT_SYNC.queueSave(chats);
    } catch (error) {
        console.error("Chat history could not be saved:", error);
        showToast("Storage is full. Delete some old chats.");
    }
}

function makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function makeTitle(text) {
    text = String(text || "Image question").trim().replace(/\s+/g, " ");
    return text.length > 42 ? text.slice(0, 42) + "Ã¢â‚¬Â¦" : text;
}

function getActiveChat() {
    return chats.find(c => c.id === activeChatId) || null;
}

function createChat(text = "") {
    const chat = {
        id: makeId(),
        title: makeTitle(text),
        messages: [],
        updatedAt: Date.now()
    };
    chats.unshift(chat);
    activeChatId = chat.id;
    return chat;
}

/* CHAT HISTORY */

function renderHistory() {
    chatHistory.innerHTML = "";

    if (!chats.length) {
        const empty = document.createElement("div");
        empty.className = "history-empty";
        empty.textContent = "Your conversations will appear here.";
        chatHistory.appendChild(empty);
        return;
    }

    [...chats].sort((a, b) => b.updatedAt - a.updatedAt).forEach(chat => {
        const item = document.createElement("div");
        item.className = "history-item";
        if (chat.id === activeChatId) item.classList.add("active");

        const open = document.createElement("button");
        open.type = "button";
        open.className = "history-open-button";
        open.title = chat.title;

        const icon = document.createElement("span");
        icon.className = "history-item-icon";
        icon.textContent = "\u22ef";

        const title = document.createElement("span");
        title.className = "history-item-title";
        title.textContent = chat.title;

        open.append(icon, title);
        open.addEventListener("click", () => openChat(chat.id));

        const del = document.createElement("button");
        del.type = "button";
        del.className = "delete-chat-button";
        del.textContent = "\u00D7";
        del.title = "Delete chat";
        del.setAttribute("aria-label", "Delete chat");
        del.addEventListener("click", event => {
            event.stopPropagation();
            deleteChat(chat.id);
        });

        item.append(open, del);
        chatHistory.appendChild(item);
    });
}

function openChat(id) {
    if (!chats.some(c => c.id === id)) return;
    activeChatId = id;
    clearSelectedImage();
    messageInput.value = "";
    resizeTextarea();
    renderHistory();
    renderCurrentChat();
    closeSidebar();
}

function startNewChat() {
    activeChatId = null;
    messageInput.value = "";
    resizeTextarea();
    clearSelectedImage();
    messages.innerHTML = "";
    conversation.classList.add("hidden");
    welcomeScreen.classList.remove("hidden");
    renderHistory();
    closeSidebar();
    messageInput.focus();
}

function deleteChat(id) {
    const chat = chats.find(c => c.id === id);
    if (!chat) return;
    if (!confirm(`Delete "${chat.title}"? This cannot be undone.`)) return;

    chats = chats.filter(c => c.id !== id);
    if (window.NAVAI_CHAT_SYNC) window.NAVAI_CHAT_SYNC.markDeleted(id);
    if (activeChatId === id) {
        activeChatId = null;
        messages.innerHTML = "";
        conversation.classList.add("hidden");
        welcomeScreen.classList.remove("hidden");
    }

    saveChats();
    renderHistory();
    renderCurrentChat();
    showToast("Chat deleted.");
}

function renderCurrentChat() {
    messages.innerHTML = "";
    const chat = getActiveChat();

    if (!chat || !chat.messages.length) {
        conversation.classList.add("hidden");
        welcomeScreen.classList.remove("hidden");
        return;
    }

    welcomeScreen.classList.add("hidden");
    conversation.classList.remove("hidden");
    chat.messages.forEach(renderMessage);
    scrollToBottom();
}

/* SAFE TEXT AND MARKDOWN */

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#39;"
    })[ch]);
}


function cleanAssistantText(value) {
    let text = String(value ?? "");
    text = text.replace(/\\+(\|)/g, "$1");
    text = text.replace(/\\+([#*_~])/g, "$1");
    text = text.replace(/\\+<br\s*\/?>/gi, "\n");
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, "");
    text = text.replace(/^\s*\|(.+)\|\s*$/gm, function (line, cells) {
        return cells.split("|").map(function (cell) {
            return cell.trim();
        }).filter(Boolean).join(" - ");
    });
    text = text.replace(/^\s*\\---+\s*$/gm, "");
    return text.trim();
}
function renderMarkdown(text) {
    let html = escapeHTML(text);
    const blocks = [];

    const saveBlock = value => {
        const token = `NAVAI_CODE_BLOCK_${blocks.length}_TOKEN`;
        blocks.push({ token, value });
        return token;
    };

    html = html.replace(/```([a-zA-Z0-9_+#.-]*)[ \t]*\n?([\s\S]*?)```/g,
        (_, language, code) => {
            const cls = language ? ` class="language-${language.replace(/[^a-zA-Z0-9_+#.-]/g, "")}"` : "";
            return saveBlock(`<pre><code${cls}>${code}</code></pre>`);
        });

    html = html.replace(/`([^`\n]+)`/g, (_, code) => saveBlock(`<code>${code}</code>`));
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");
    html = html.replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/gs, "<em>$1</em>");

    html = html.replace(/(?:^[ \t]*[-*] .+(?:\n|$))+/gm, block =>
        `<ul>${block.trim().split("\n").map(line =>
            `<li>${line.replace(/^[ \t]*[-*] /, "")}</li>`).join("")}</ul>`);

    html = html.replace(/(?:^[ \t]*\d+\. .+(?:\n|$))+/gm, block =>
        `<ol>${block.trim().split("\n").map(line =>
            `<li>${line.replace(/^[ \t]*\d+\. /, "")}</li>`).join("")}</ol>`);

    html = html.split(/\n{2,}/).map(part => {
        const trimmed = part.trim();
        if (!trimmed) return "";
        if (/^(<h[1-3]>|<ul>|<ol>|<blockquote>|<pre>)/i.test(trimmed)) {
            return trimmed.replace(/\n/g, "");
        }
        return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    }).join("");

    blocks.forEach(block => {
        html = html.split(block.token).join(block.value);
    });

    return html;
}

function renderMessage(message) {
    const row = document.createElement("article");
    row.className = `message-row ${message.role}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = message.role === "user" ? "Y" : "N";

    const content = document.createElement("div");
    content.className = "message-content";

    const author = document.createElement("div");
    author.className = "message-author";
    author.textContent = message.role === "user" ? "You" : "NavAI";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (message.image && message.image.startsWith("data:image/")) {
        const img = document.createElement("img");
        img.className = "message-image";
        img.src = message.image;
        img.alt = "Uploaded image";
        img.loading = "lazy";
        bubble.appendChild(img);
    }

    if (message.content) {
        const text = document.createElement("div");
        text.innerHTML = message.role === "assistant"
            ? renderMarkdown(cleanAssistantText(message.content))
            : escapeHTML(message.content).replace(/\n/g, "<br>");
        bubble.appendChild(text);
    }

    content.append(author, bubble);

    if (message.role === "assistant") {
        const actions = document.createElement("div");
        actions.className = "message-actions";

        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "message-action-button";
        copy.textContent = "Copy answer";
        copy.addEventListener("click", async () => {
            try {
                await copyText(message.content);
                copy.textContent = "Copied!";
                setTimeout(() => copy.textContent = "Copy answer", 1500);
            } catch {
                showToast("Could not copy the answer.");
            }
        });

        actions.appendChild(copy);
        content.appendChild(actions);
    }

    row.append(avatar, content);
    messages.appendChild(row);
    return row;
}

function addTypingIndicator() {
    const row = document.createElement("article");
    row.className = "message-row assistant";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = "N";

    const content = document.createElement("div");
    content.className = "message-content";

    const author = document.createElement("div");
    author.className = "message-author";
    author.textContent = "NavAI";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    const typing = document.createElement("div");
    typing.className = "typing-indicator";
    typing.setAttribute("aria-label", "NavAI is thinking");

    for (let i = 0; i < 3; i++) typing.appendChild(document.createElement("span"));

    bubble.appendChild(typing);
    content.append(author, bubble);
    row.append(avatar, content);
    messages.appendChild(row);
    scrollToBottom();
    return row;
}

async function copyText(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const success = document.execCommand("copy");
    area.remove();
    if (!success) throw new Error("Copy failed");
}

/* SEND MESSAGE Ã¢â‚¬â€ supports response, answer, or reply */

chatForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (isSending) return;

    const text = messageInput.value.trim();
    if (!text && !currentImage) {
        messageInput.focus();
        return;
    }

    const imageToSend = currentImage;
    const imageName = currentImageName;
    let chat = getActiveChat();

    if (!chat) chat = createChat(text || "Image question");

    const history = chat.messages.slice(-8).map(m => ({
        role: m.role,
        content: m.content || ""
    }));

    const userMessage = {
        role: "user",
        content: text,
        image: imageToSend,
        imageName,
        time: Date.now()
    };

    chat.messages.push(userMessage);
    chat.updatedAt = Date.now();

    if (chat.messages.filter(m => m.role === "user").length === 1) {
        chat.title = makeTitle(text || "Image question");
    }

    saveChats();
    renderHistory();
    welcomeScreen.classList.add("hidden");
    conversation.classList.remove("hidden");
    renderMessage(userMessage);
    scrollToBottom();

    messageInput.value = "";
    resizeTextarea();
    clearSelectedImage();

    isSending = true;
    sendBtn.disabled = true;
    attachBtn.disabled = true;
    messageInput.disabled = true;

    const typingRow = addTypingIndicator();

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: text,
                image: imageToSend,
                history
            })
        });

        let result;
        try {
            result = await response.json();
        } catch {
            throw new Error("The server returned an invalid response.");
        }

        if (!response.ok) {
            throw new Error(result.error || `Request failed (${response.status}).`);
        }

        const aiReply = result.response || result.answer || result.reply;

        if (typeof aiReply !== "string" || !aiReply.trim()) {
            throw new Error("The AI returned an empty response.");
        }

        const assistantMessage = {
            role: "assistant",
            content: aiReply,
            image: null,
            time: Date.now()
        };

        chat.messages.push(assistantMessage);
        chat.updatedAt = Date.now();
        saveChats();
        renderHistory();

        if (activeChatId === chat.id) {
            typingRow.remove();
            renderMessage(assistantMessage);
            scrollToBottom();
        }
    } catch (error) {
        console.error("NavAI request failed:", error);

        const errorMessage = {
            role: "assistant",
            content: `I couldn't complete that request. ${error.message || "Check that NavAI and Ollama are running, then try again."}`,
            image: null,
            time: Date.now()
        };

        chat.messages.push(errorMessage);
        chat.updatedAt = Date.now();
        saveChats();
        renderHistory();

        if (activeChatId === chat.id) {
            typingRow.remove();
            renderMessage(errorMessage);
            scrollToBottom();
        }
    } finally {
        isSending = false;
        sendBtn.disabled = false;
        attachBtn.disabled = false;
        messageInput.disabled = false;
        messageInput.focus();
    }
});

/* IMAGE UPLOAD */

const navaiPlusMenu = document.createElement("div");
navaiPlusMenu.className = "navai-plus-menu";
navaiPlusMenu.hidden = true;
navaiPlusMenu.innerHTML = `
    <button type="button" class="navai-plus-menu-item" data-action="attach">??Attach image</button>
    <button type="button" class="navai-plus-menu-item" data-action="create">??Create Image</button>`;
attachBtn.insertAdjacentElement("afterend", navaiPlusMenu);
attachBtn.setAttribute("aria-expanded", "false");

function closeNavaiPlusMenu() {
    navaiPlusMenu.hidden = true;
    attachBtn.setAttribute("aria-expanded", "false");
}

attachBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (isSending || attachBtn.disabled) return;
    navaiPlusMenu.hidden = !navaiPlusMenu.hidden;
    attachBtn.setAttribute("aria-expanded", String(!navaiPlusMenu.hidden));
});

navaiPlusMenu.addEventListener("click", (event) => {
    const item = event.target.closest("[data-action]");
    if (!item || isSending) return;
    const action = item.dataset.action;
    closeNavaiPlusMenu();
    if (action === "attach") imageInput.click();
    if (action === "create") document.dispatchEvent(new Event("navai:open-image-generator"));
});

document.addEventListener("click", (event) => {
    if (!navaiPlusMenu.contains(event.target) && !attachBtn.contains(event.target)) closeNavaiPlusMenu();
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNavaiPlusMenu();
});

imageInput.addEventListener("change", async () => {
    const file = imageInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showToast("Please select an image file.");
        imageInput.value = "";
        return;
    }

    if (file.size > 15 * 1024 * 1024) {
        showToast("Choose an image smaller than 15 MB.");
        imageInput.value = "";
        return;
    }

    attachBtn.disabled = true;

    try {
        showToast("Preparing imageÃ¢â‚¬Â¦");
        currentImage = await compressImage(file);
        currentImageName = file.name;
        imagePreview.src = currentImage;
        imageFileName.textContent = file.name;
        imagePreviewContainer.classList.remove("hidden");
        messageInput.focus();
        showToast("Image ready to send.");
    } catch (error) {
        console.error("Image processing failed:", error);
        showToast("This image could not be opened. Try another image.");
    } finally {
        attachBtn.disabled = isSending;
        imageInput.value = "";
    }
});

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = () => reject(new Error("Could not read image."));
        reader.onload = () => {
            const img = new Image();

            img.onerror = () => reject(new Error("Could not open image."));
            img.onload = () => {
                const max = 1280;
                const scale = Math.min(1, max / Math.max(img.width, img.height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));

                const context = canvas.getContext("2d");
                if (!context) {
                    reject(new Error("Image processing is unavailable."));
                    return;
                }

                context.fillStyle = "#ffffff";
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.78));
            };

            img.src = reader.result;
        };

        reader.readAsDataURL(file);
    });
}

function clearSelectedImage() {
    currentImage = null;
    currentImageName = "";
    imagePreview.src = "";
    imageFileName.textContent = "";
    imagePreviewContainer.classList.add("hidden");
}

removeImageBtn.addEventListener("click", clearSelectedImage);

/* INPUT AND SUGGESTIONS */

messageInput.addEventListener("input", resizeTextarea);

function resizeTextarea() {
    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 170) + "px";
}

messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (!isSending) chatForm.requestSubmit();
    }
});

document.querySelectorAll(".suggestion-card").forEach(button => {
    button.addEventListener("click", () => {
        messageInput.value = button.dataset.prompt || "";
        resizeTextarea();
        messageInput.focus();
    });
});

/* THEME */

function setTheme(theme) {
    const selected = theme === "light" ? "light" : "dark";
    document.body.dataset.theme = selected;

    const icon = $("themeIcon");
    const label = $("themeLabel");

    if (icon) icon.textContent = (selected === "dark" ? "\u263C" : "\u263E");
    if (label) label.textContent = selected === "dark" ? "Switch to light mode" : "Switch to dark mode";

    try {
        localStorage.setItem(THEME_KEY, selected);
    } catch (error) {
        console.warn("Could not save theme:", error);
    }
}

$("themeBtn").addEventListener("click", () => {
    setTheme((document.body.dataset.theme || "dark") === "dark" ? "light" : "dark");
});

/* SIDEBAR AND NAVIGATION */

$("newChatBtn").addEventListener("click", startNewChat);

$("homeBtn").addEventListener("click", event => {
    event.preventDefault();
    startNewChat();
});

$("menuBtn").addEventListener("click", closeSidebar);
$("mobileMenuBtn").addEventListener("click", openSidebar);
$("sidebarOverlay").addEventListener("click", closeSidebar);

$("historyBtn").addEventListener("click", () => {
    if (window.innerWidth <= 650) openSidebar();
    chatHistory.scrollTop = 0;
});

function openSidebar() {
    document.body.classList.add("sidebar-open");
}

function closeSidebar() {
    document.body.classList.remove("sidebar-open");
}

document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        startNewChat();
    }
    if (event.key === "Escape") closeSidebar();
});

/* UTILITIES */

function scrollToBottom() {
    requestAnimationFrame(() => {
        conversation.scrollTop = conversation.scrollHeight;
    });
}

function showToast(message) {
    let toast = document.querySelector(".navai-toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.className = "navai-toast";

        Object.assign(toast.style, {
            position: "fixed",
            bottom: "105px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: "100",
            maxWidth: "90vw",
            padding: "11px 16px",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            background: "var(--panel)",
            color: "var(--text)",
            boxShadow: "0 8px 30px rgba(0,0,0,.25)",
            fontSize: "12px",
            textAlign: "center"
        });

        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.style.display = "none", 2500);
}

/* STARTUP */

try {
    setTheme(localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark");
} catch {
    setTheme("dark");
}

renderHistory();
startNewChat();

// NavAI cloud-sync bridge: keeps the existing chat UI intact.
window.NAVAI_CHAT_BRIDGE = {
    getChats: () => chats.map(chat => ({
        ...chat,
        messages: chat.messages.map(message => ({ ...message }))
    })),
    replaceChats: (items) => {
        chats = items.map(chat => ({
            id: String(chat.id),
            title: String(chat.title || "New chat"),
            updatedAt: Number(chat.updatedAt || Date.now()),
            messages: Array.isArray(chat.messages) ? chat.messages : []
        })).sort((a, b) => b.updatedAt - a.updatedAt);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
        } catch (error) {
            console.error("Could not update local chat cache:", error);
        }

        if (activeChatId && !chats.some(chat => chat.id === activeChatId)) {
            activeChatId = null;
        }
        renderHistory();
        renderCurrentChat();
    }
};
console.log("NavAI frontend loaded successfully.");



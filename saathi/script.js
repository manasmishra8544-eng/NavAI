
"use strict";

const $ = id => document.getElementById(id);
const KEY = "navai.saathi.v1";

const defaults = {
  profile:{name:"",age:"",occupation:"",interests:"",schedule:"",goals:"",food:"",tone:"warm and friendly",language:"hinglish",voiceName:"auto"},
  tasks:[],routines:[],moods:[],settings:{voice:false,notifications:false,auto:false,quietStart:"22:00",quietEnd:"07:00"},
  mode:"companion",messages:[]
};

const VALID_MODES = new Set(["companion", "care", "mentor", "friend", "manager"]);

let data = load();

if (!VALID_MODES.has(data.mode)) {
  data.mode = "companion";
  save();
}
let busy = false;
let recognition = null;

function load(){
  try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||"{}")};}
  catch{return structuredClone(defaults);}
}
function save(){
  if(data.chats && VALID_MODES.has(data.mode)){
    data.chats[data.mode] = data.messages;
  }
  localStorage.setItem(KEY,JSON.stringify(data));
}

function initializeModeChats(){
  const oldMessages = Array.isArray(data.messages) ? data.messages : [];
  const hadChats = data.chats &&
    typeof data.chats === "object" &&
    !Array.isArray(data.chats);

  if(!hadChats){
    data.chats = {};
    for(const mode of VALID_MODES){
      data.chats[mode] = [];
    }
    if(VALID_MODES.has(data.mode)){
      data.chats[data.mode] = oldMessages;
    }
  }

  for(const mode of VALID_MODES){
    if(!Array.isArray(data.chats[mode])){
      data.chats[mode] = [];
    }
  }

  if(!VALID_MODES.has(data.mode)){
    data.mode = "companion";
  }

  data.messages = data.chats[data.mode];
  save();
}

initializeModeChats();
function toast(message){
  $("toast").textContent=message;
  $("toast").classList.add("show");
  setTimeout(()=>$("toast").classList.remove("show"),2600);
}
function escapeHTML(s){
  return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function getTime(){
  return new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
}
function updateProfile(){
  const p=data.profile;
  $("greeting").innerHTML=`Hello, ${escapeHTML(p.name||"there")}. <span>✦</span>`;
  $("miniName").textContent=p.name||"Your profile";
  $("miniAvatar").textContent=(p.name||"U")[0].toUpperCase();
  $("todayDate").textContent=new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"});
}
function showView(name){
  ["home","chat","tasks","routine","memory","settings"].forEach(v=>{
    $(v+"View").classList.toggle("hidden",v!==name);
  });
  $("pageName").textContent=name==="memory"?"My profile":name.charAt(0).toUpperCase()+name.slice(1);
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  $("sidebar").classList.remove("open");
  if(name==="tasks")renderTasks();
  if(name==="routine")renderRoutines();
  if(name==="memory")fillProfile();
  if(name==="chat")setTimeout(()=>$("chatInput").focus(),100);
}
const modeNames = {
  companion: "NavAI Saathi",
  care: "Caring guide",
  mentor: "Mentor",
  friend: "Friend",
  manager: "Life manager"
};

function setMode(mode) {
  if (!VALID_MODES.has(mode)) mode = "companion";

  data.chats[data.mode] = data.messages;
  data.mode = mode;
  data.messages = data.chats[mode];

  save();

  $("chatModeName").textContent = modeNames[mode];

  document.querySelectorAll(".mode").forEach(button => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });

  renderMessages();
  showView("chat");
}
function addMessage(role,text){
  data.messages.push({role,text,time:Date.now()});
  if(data.messages.length>100)data.messages=data.messages.slice(-100);
  save();
  renderMessages();
}

function renderAssistantMarkdown(value) {
  const source = String(value ?? "").replace(/\r\n?/g, "\n");
  const codeBlocks = [];

  let prepared = source.replace(
    /```(?:[a-zA-Z0-9_+-]+)?[ \t]*\n([\s\S]*?)```/g,
    (_, code) => {
      const index = codeBlocks.length;
      codeBlocks.push(
        `<pre><code>${escapeHTML(code.replace(/\n$/, ""))}</code></pre>`
      );
      return `NAVAI_CODE_BLOCK_${index}_PLACEHOLDER`;
    }
  );

  let safe = escapeHTML(prepared);

  safe = safe
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>");

  const lines = safe.split("\n");
  const output = [];
  let paragraph = [];
  let listType = null;
  let listItems = [];

  function flushParagraph() {
    if (paragraph.length) {
      output.push(`<p>${paragraph.join("<br>")}</p>`);
      paragraph = [];
    }
  }

  function flushList() {
    if (listType && listItems.length) {
      output.push(
        `<${listType}>${listItems.map(item => `<li>${item}</li>`).join("")}</${listType}>`
      );
    }
    listType = null;
    listItems = [];
  }

  for (const line of lines) {
    const codeMatch = line.match(/^NAVAI_CODE_BLOCK_(\d+)_PLACEHOLDER$/);
    if (codeMatch) {
      flushParagraph();
      flushList();
      output.push(codeBlocks[Number(codeMatch[1])]);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      output.push(`<h${level}>${heading[2]}</h${level}>`);
      continue;
    }

    const quote = line.match(/^&gt;\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      output.push(`<blockquote>${quote[1]}</blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);

    if (unordered || ordered) {
      flushParagraph();
      const nextType = unordered ? "ul" : "ol";
      if (listType && listType !== nextType) flushList();
      listType = nextType;
      listItems.push((unordered || ordered)[1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return output.join("");
}

function renderMessages(){
    const el = $("messages");
    el.innerHTML = data.messages.map(m => `
      <div class="message ${m.role === "user" ? "user" : "assistant"}">
        <div class="bubble">${
          m.role === "user"
            ? escapeHTML(m.text).replace(/\n/g, "<br>")
            : renderAssistantMarkdown(m.text)
        }</div>
      </div>`).join("");
    el.scrollTop = el.scrollHeight;
}
function loadChat(){
  renderMessages();
}
function buildContext(){
  const p=data.profile;
  const pending=data.tasks.filter(t=>!t.done);
  return {
    profile:p,
    currentTime:new Date().toLocaleString(),
    mode:data.mode,
    pendingTasks:pending,
    routines:data.routines,
    recentMoods:data.moods.slice(-5),
    instructions:"Use this information only to personalise assistance. Do not claim to be a real parent, teacher, human friend or romantic partner. Be supportive, respectful and honest. Never invent personal facts or claim to have sent a notification."
  };
}

/*
  IMPORTANT:
  Set this endpoint to the actual NavAI backend route.
  Expected request/response contract:
  POST /api/saathi/chat
  JSON: {message, mode, context, history}
  Response JSON: {reply:"..."}
  Create this route in your existing Flask backend before enabling API chat.
*/
const API_ENDPOINT="/api/saathi/chat";

async function sendMessage(text){
  text=text.trim();
  if(!text||busy)return;
  $("chatInput").value="";
  addMessage("user",text);
  busy=true;$("sendBtn").disabled=true;
  const wait=document.createElement("div");
  wait.className="message assistant";
  wait.innerHTML='<div class="bubble">Saathi is thinking…</div>';
  $("messages").appendChild(wait);
  try{
    const response=await fetch(API_ENDPOINT,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      credentials:"same-origin",
      body:JSON.stringify({
        message:text,
        mode:data.mode,
        context:buildContext(),
        history:data.messages.slice(-16)
      })
    });
    if(!response.ok)throw new Error("API request failed: "+response.status);
    const result=await response.json();
    if(typeof result.reply!=="string")throw new Error("Invalid API response");
    wait.remove();
    addMessage("assistant",result.reply);
    speak(result.reply);
  }catch(error){
    wait.remove();
    addMessage("assistant","I'm unable to connect to the NavAI brain right now. Please check that the Saathi API route is configured and your server is running.");
    console.error(error);
  }finally{
    busy=false;$("sendBtn").disabled=false;
  }
}
function getSaathiLanguage(){
  const language = data.profile.language || "hinglish";
  if(language === "hindi") return "hi-IN";
  if(language === "english") return "en-IN";
  return "hi-IN";
}

function getPreferredSaathiVoice(){
  if(!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if(!voices || !voices.length) return null;

  const selected = data.profile.voiceName || "auto";

  if(selected !== "auto"){
    const exact = voices.find(v => v.voiceURI === selected);
    if(exact) return exact;
  }

  const language = getSaathiLanguage();
  const matching = voices.filter(v =>
    (v.lang || "").toLowerCase().startsWith(language.slice(0,2).toLowerCase())
  );

  const femaleName = /(female|woman|swara|aditi|heera|kalpana|veena|raveena|priya|neerja|pallavi|sangeeta|lekha|kavya|ananya|sneha|manisha)/i;

  return matching.find(v => femaleName.test(v.name)) ||
    matching[0] ||
    voices.find(v => femaleName.test(v.name)) ||
    null;
}

function populateVoiceOptions(){
  const select = $("profileVoice");
  if(!select || !("speechSynthesis" in window)) return;

  const previous = data.profile.voiceName || "auto";
  const voices = window.speechSynthesis.getVoices();

  select.innerHTML = '<option value="auto">Automatic available voice</option>';

  voices.forEach(voice => {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent = voice.name + " (" + voice.lang + ")";
    select.appendChild(option);
  });

  if(previous === "auto" || voices.some(v => v.voiceURI === previous)){
    select.value = previous;
  }else{
    select.value = "auto";
  }
}

function speak(text){
  if(
    !data.settings.voice ||
    !("speechSynthesis" in window) ||
    !("SpeechSynthesisUtterance" in window)
  ) return;

  try {
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(String(text));
    const voice = getPreferredSaathiVoice();

    utterance.lang = voice ? voice.lang : getSaathiLanguage();
    if(voice) utterance.voice = voice;

    utterance.rate = 0.94;
    utterance.pitch = 1.05;
    utterance.volume = 1;

    synth.speak(utterance);
  } catch(error) {
    console.error("Saathi speech error:",error);
  }
}
function startVoice(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if(!SR){
    toast("Is browser mein voice input supported nahi hai.");
    return;
  }

  if(recognition){
    recognition.stop();
    recognition = null;
    return;
  }

  recognition = new SR();
  recognition.lang = getSaathiLanguage();
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 3;

  recognition.onresult = e => {
    $("chatInput").value = e.results[0][0].transcript || "";
    $("chatInput").focus();
  };

  recognition.onerror = () => {
    toast("Voice input start nahi ho paya. Dobara try karo.");
  };

  recognition.onend = () => {
    recognition = null;
    $("voiceBtn").classList.remove("recording");
  };

  try {
    recognition.start();
    $("voiceBtn").classList.add("recording");
  } catch(error) {
    recognition = null;
    $("voiceBtn").classList.remove("recording");
    toast("Microphone start nahi ho paya.");
  }
}
function fillProfile(){
  const p=data.profile;
  const fields={profileName:"name",profileAge:"age",profileOccupation:"occupation",profileInterests:"interests",profileSchedule:"schedule",profileGoals:"goals",profileFood:"food",profileTone:"tone",profileLanguage:"language"};
  Object.entries(fields).forEach(([id,key])=>$(id).value=p[key]||"");
}
function renderTasks(){
  const html=data.tasks.map(t=>`
    <div class="task-row ${t.done?"done":""}">
      <input type="checkbox" data-task="${t.id}" ${t.done?"checked":""}>
      <span>${escapeHTML(t.title)} ${t.time?" · "+escapeHTML(t.time):""}</span>
      <button data-delete-task="${t.id}">✕</button>
    </div>`).join("")||'<p class="empty">No tasks yet. Add your first task.</p>';
  $("allTasks").innerHTML=html;
  $("taskPreview").innerHTML=data.tasks.filter(t=>!t.done).slice(0,3).map(t=>`<div class="task-row"><span>${escapeHTML(t.title)}</span><small>${escapeHTML(t.time||"")}</small></div>`).join("")||'<p class="empty">Your day starts with one small step.</p>';
}
function renderRoutines(){
  $("routineList").innerHTML=data.routines.map(r=>`
    <div class="routine-row"><span>◷ ${escapeHTML(r.time)} · ${escapeHTML(r.title)}</span><span>${escapeHTML(r.repeat)} <button data-delete-routine="${r.id}">✕</button></span></div>`).join("")||'<p class="empty">No routines added yet.</p>';
}
function saveSettings(){
  data.settings={
    voice:$("voiceReplies").checked,
    notifications:$("notifications").checked,
    auto:$("autoCheckin").checked,
    quietStart:$("quietStart").value,
    quietEnd:$("quietEnd").value
  };
  save();
  if(data.settings.notifications) syncNativeRoutineReminders();
  toast("Settings saved.");
}
function fillSettings(){
  $("voiceReplies").checked=data.settings.voice;
  $("notifications").checked=data.settings.notifications;
  $("autoCheckin").checked=data.settings.auto;
  $("quietStart").value=data.settings.quietStart;
  $("quietEnd").value=data.settings.quietEnd;
}
function inQuietHours(){
  const [sh,sm]=data.settings.quietStart.split(":").map(Number);
  const [eh,em]=data.settings.quietEnd.split(":").map(Number);
  const now=new Date(),current=now.getHours()*60+now.getMinutes();
  const start=sh*60+sm,end=eh*60+em;
  return start>end?(current>=start||current<end):(current>=start&&current<end);
}
function notify(title,body,tag){
  if(
    !data.settings.notifications ||
    !("Notification" in window) ||
    Notification.permission !== "granted" ||
    inQuietHours()
  ) return false;

  try {
    const notice = new Notification(title,{
      body: body,
      tag: tag || "navai-saathi",
      requireInteraction: true,
      renotify: false
    });

    if(tag && tag.indexOf("navai-routine-") === 0){
      routineReminderState.notification = notice;

      notice.onclose = () => {
        if(routineReminderState.active){
          stopRoutineReminder();
        }
      };
    }

    notice.onclick = () => {
      window.focus();
      notice.close();
      showView("routine");
    };

    return true;
  } catch(error) {
    console.error("Saathi notification error:",error);
    return false;
  }
}

const routineReminderState = {
  active: null,
  timer: null,
  panel: null
};

function getRoutineReminderLanguage(){
  const language = String(data.profile?.language || "hinglish").toLowerCase();
  return ["hindi","english","hinglish"].includes(language)
    ? language
    : "hinglish";
}

function getRoutineReminderMessage(title){
  const language = getRoutineReminderLanguage();
  const safeTitle = String(title || "your activity");

  if(language === "hindi"){
    return "नमस्ते! " + safeTitle +
      " का समय हो गया है। ठीक है, कर लो।";
  }

  if(language === "english"){
    return "Hello! It's time for " + safeTitle +
      ". You can do this.";
  }

  return "Hey! " + safeTitle +
    " ka time ho gaya hai. Theek hai, kar lo.";
}
function createRoutineReminderPanel(){
  if(routineReminderState.panel &&
     document.body.contains(routineReminderState.panel)){
    return routineReminderState.panel;
  }

  const style = document.createElement("style");
  style.id = "navai-routine-reminder-style";
  style.textContent = `
    #navaiActiveRoutineReminder {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 99999;
      width: min(390px, calc(100vw - 28px));
      padding: 20px;
      border: 1px solid #e6d8f3;
      border-radius: 20px;
      background: #fffaff;
      color: #40334f;
      box-shadow: 0 16px 48px rgba(65, 43, 91, .18);
      font-family: inherit;
    }
    #navaiActiveRoutineReminder .navai-reminder-heading {
      font-size: 16px;
      font-weight: 750;
      margin-bottom: 8px;
      color: #65458b;
    }
    #navaiActiveRoutineReminder .navai-reminder-message {
      font-size: 14px;
      line-height: 1.65;
      margin-bottom: 16px;
      color: #594d66;
      overflow-wrap: anywhere;
    }
    #navaiActiveRoutineReminder .navai-reminder-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    #navaiActiveRoutineReminder button {
      border: 0;
      border-radius: 12px;
      padding: 11px 15px;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    #navaiReminderDone {
      flex: 1;
      color: white;
      background: #8966b3;
    }
    #navaiReminderClose {
      color: #65458b;
      background: #f0e8f8;
    }
    @media(max-width:520px){
      #navaiActiveRoutineReminder {
        right: 14px;
        bottom: 14px;
      }
    }
  `;

  if(!document.getElementById("navai-routine-reminder-style")){
    document.head.appendChild(style);
  }

  const panel = document.createElement("div");
  panel.id = "navaiActiveRoutineReminder";
  panel.setAttribute("role","alertdialog");
  panel.setAttribute("aria-live","polite");

  const heading = document.createElement("div");
  heading.className = "navai-reminder-heading";
  heading.textContent = "✦ NavAI Saathi · Gentle reminder";

  const message = document.createElement("div");
  message.className = "navai-reminder-message";
  message.id = "navaiReminderMessage";

  const actions = document.createElement("div");
  actions.className = "navai-reminder-actions";

  const done = document.createElement("button");
  done.type = "button";
  done.id = "navaiReminderDone";
  done.textContent = "ठीक है ✓";

  const close = document.createElement("button");
  close.type = "button";
  close.id = "navaiReminderClose";
  close.textContent = "Close";

  done.addEventListener("click", stopRoutineReminder);
  close.addEventListener("click", stopRoutineReminder);

  actions.append(done,close);
  panel.append(heading,message,actions);
  document.body.appendChild(panel);

  routineReminderState.panel = panel;
  return panel;
}

function stopRoutineReminder(){
  const active = routineReminderState.active;

  if(routineReminderState.timer){
    clearTimeout(routineReminderState.timer);
    routineReminderState.timer = null;
  }

  if("speechSynthesis" in window){
    window.speechSynthesis.cancel();
  }

  if(active && active.key){
    localStorage.setItem(active.key,"done");
  }

  routineReminderState.active = null;

  const notification = routineReminderState.notification;
  routineReminderState.notification = null;

  if(notification){
    notification.close();
  }

  if(routineReminderState.panel){
    routineReminderState.panel.remove();
    routineReminderState.panel = null;
  }

  toast("Reminder stopped. Well done!");
}

function speakRoutineReminder(){
  const active = routineReminderState.active;
  if(!active) return;

  if(!("speechSynthesis" in window) ||
     !("SpeechSynthesisUtterance" in window)){
    routineReminderState.timer = setTimeout(
      speakRoutineReminder, 2000
    );
    return;
  }

  try {
    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(
      getRoutineReminderMessage(active.title)
    );

    const voice = getPreferredSaathiVoice();
    const language = getRoutineReminderLanguage();

    if(voice){
      speech.voice = voice;
      speech.lang = voice.lang || (
        language === "english" ? "en-IN" : "hi-IN"
      );
    }else{
      speech.lang = language === "english" ? "en-IN" : "hi-IN";
    }

    speech.rate = 0.88;
    speech.pitch = 1.03;
    speech.volume = 1;

    let repeatScheduled = false;

    const scheduleNextRepeat = () => {
      if(repeatScheduled) return;
      repeatScheduled = true;

      if(!routineReminderState.active ||
         routineReminderState.active.key !== active.key){
        return;
      }

      if(routineReminderState.timer){
        clearTimeout(routineReminderState.timer);
      }

      routineReminderState.timer = setTimeout(() => {
        routineReminderState.timer = null;

        if(routineReminderState.active &&
           routineReminderState.active.key === active.key){
          speakRoutineReminder();
        }
      },2000);
    };

    speech.onend = scheduleNextRepeat;
    speech.onerror = scheduleNextRepeat;

    window.speechSynthesis.speak(speech);
  } catch(error) {
    console.error("Saathi routine voice error:",error);

    if(routineReminderState.active &&
       routineReminderState.active.key === active.key){
      routineReminderState.timer = setTimeout(
        speakRoutineReminder, 2000
      );
    }
  }
}

function startRoutineReminder(routine,today){
  if(routineReminderState.active) return;

  const reminderKey =
    KEY + ".routineReminder." + routine.id + "." + today;

  if(localStorage.getItem(reminderKey) === "done") return;

  routineReminderState.active = {
    id: routine.id,
    title: String(routine.title),
    key: reminderKey
  };

  const panel = createRoutineReminderPanel();
  const message = panel.querySelector("#navaiReminderMessage");

  if(message){
    message.textContent = getRoutineReminderMessage(routine.title);
  }

  // Browser notification is optional; voice reminder works independently.
  notify(
    "NavAI Saathi - Routine reminder",
    getRoutineReminderMessage(routine.title),
    "navai-routine-" + routine.id + "-" + today
  );

  speakRoutineReminder();
}

function checkRoutineReminders(){
  if(routineReminderState.active) return;
  if(!Array.isArray(data.routines) || !data.routines.length) return;
  if(inQuietHours()) return;

  const now = new Date();
  const today = now.getFullYear() + "-" +
    String(now.getMonth()+1).padStart(2,"0") + "-" +
    String(now.getDate()).padStart(2,"0");

  const currentMinutes = now.getHours()*60 + now.getMinutes();
  const weekday = now.getDay();

  for(const routine of data.routines){
    if(!routine || !routine.id || !routine.time || !routine.title) continue;

    if(
      routine.repeat === "weekdays" &&
      (weekday === 0 || weekday === 6)
    ) continue;

    const parts = routine.time.split(":").map(Number);

    if(
      parts.length !== 2 ||
      parts.some(n => !Number.isFinite(n)) ||
      parts[0] < 0 || parts[0] > 23 ||
      parts[1] < 0 || parts[1] > 59
    ) continue;

    const targetMinutes = parts[0]*60 + parts[1];
    const difference = currentMinutes - targetMinutes;

    if(difference < 0 || difference > 10) continue;

    const reminderKey =
      KEY + ".routineReminder." + routine.id + "." + today;

    if(localStorage.getItem(reminderKey) === "done") continue;

    startRoutineReminder(routine,today);
    break;
  }
}

// Native Android reminders: AlarmManager continues after the app is swiped away.
function scheduleNativeRoutine(routine){
  if(!window.NavAIAndroid || typeof window.NavAIAndroid.scheduleReminder !== "function") return false;
  if(!routine || !routine.id || !routine.time || !routine.title) return false;

  const parts = routine.time.split(":").map(Number);
  if(parts.length !== 2 || parts[0] < 0 || parts[0] > 23 || parts[1] < 0 || parts[1] > 59) return false;

  const now = new Date();
  let scheduled = 0;
  // Keep a rolling 14-day schedule on Android, including weekday-only routines.
  for(let dayOffset = 0; dayOffset < 14; dayOffset++){
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, parts[0], parts[1], 0, 0);
    if(target.getTime() <= Date.now() + 5000) continue;
    if(routine.repeat === "weekdays" && (target.getDay() === 0 || target.getDay() === 6)) continue;
    const dateKey = target.getFullYear() + "-" +
      String(target.getMonth()+1).padStart(2,"0") + "-" +
      String(target.getDate()).padStart(2,"0");
    const nativeId = String(routine.id) + "-" + dateKey;
    try{
      window.NavAIAndroid.scheduleReminder(nativeId, String(routine.title), getRoutineReminderMessage(routine.title), getRoutineReminderLanguage(), target.getTime());
      scheduled++;
    }catch(error){ console.error("Native reminder scheduling failed", error); }
  }
  return scheduled > 0;
}

function syncNativeRoutineReminders(){
  if(!window.NavAIAndroid) return;
  if(!data.settings.notifications) return;

  if(typeof window.NavAIAndroid.hasReminderPermissions === "function" &&
     !window.NavAIAndroid.hasReminderPermissions()) return;

  (data.routines || []).forEach(scheduleNativeRoutine);
}

function scheduleCheck(){
  const today=new Date().toDateString();
  const last=localStorage.getItem(KEY+".lastCheckin");

  if(data.settings.auto && last!==today){
    const hour=new Date().getHours();

    if(hour>=8 && hour<11){
      notify(
        "NavAI Saathi",
        "Good morning! What would you like to focus on today?",
        "navai-daily-checkin-" + today
      );
      localStorage.setItem(KEY+".lastCheckin",today);
    }
  }

  checkRoutineReminders();
}
function init(){
  updateProfile();loadChat();renderTasks();renderRoutines();fillSettings();populateVoiceOptions();

  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
  document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));

  $("newChat").onclick=()=>{
    data.messages=[];
    data.chats[data.mode]=[];
    save();
    renderMessages();
    addMessage("assistant","Hello! I'm here. What would you like to talk about?");
  };
  $("startChat").onclick=()=>setMode("companion");
  $("openProfile").onclick=()=>showView("memory");
  $("routineReminderBtn").onclick=()=>{showView("routine");$("sidebar").classList.remove("open");};
  $("settingsBtn").onclick=()=>showView("settings");
  $("menuToggle").onclick=()=>$("sidebar").classList.toggle("open");
  $("viewTasks").onclick=()=>showView("tasks");
  $("addTask").onclick=()=>{showView("tasks");$("taskInput").focus();};
  $("chatForm").onsubmit=e=>{e.preventDefault();sendMessage($("chatInput").value);};
  $("voiceBtn").onclick=startVoice;
  $("clearChat").onclick=()=>{
    if(confirm("Clear this conversation?")){
      data.messages=[];
      data.chats[data.mode]=[];
      save();
      renderMessages();
    }
  };
  $("suggestions").onclick=e=>{
    if(e.target.tagName==="BUTTON")sendMessage(e.target.textContent);
  };
  $("profileForm").onsubmit=e=>{
    e.preventDefault();
    data.profile={
      name:$("profileName").value.trim(),age:$("profileAge").value,
      occupation:$("profileOccupation").value.trim(),interests:$("profileInterests").value.trim(),
      schedule:$("profileSchedule").value.trim(),goals:$("profileGoals").value.trim(),
      food:$("profileFood").value.trim(),tone:$("profileTone").value,language:$("profileLanguage").value,voiceName:$("profileVoice").value
    };
    save();updateProfile();toast("Your profile has been saved.");
  };
  $("taskForm").onsubmit=e=>{
    e.preventDefault();
    data.tasks.push({id:Date.now(),title:$("taskInput").value.trim(),time:$("taskTime").value,done:false});
    save();e.target.reset();renderTasks();toast("Task added.");
  };
  $("allTasks").onclick=e=>{
    const id=Number(e.target.dataset.deleteTask);
    if(id){data.tasks=data.tasks.filter(t=>t.id!==id);save();renderTasks();}
  };
  $("allTasks").onchange=e=>{
    const id=Number(e.target.dataset.task);
    const task=data.tasks.find(t=>t.id===id);
    if(task){task.done=e.target.checked;save();renderTasks();}
  };
  $("routineForm").onsubmit=e=>{
    e.preventDefault();
    const routine={id:Date.now(),title:$("routineTitle").value.trim(),time:$("routineTime").value,repeat:$("routineRepeat").value};
    data.routines.push(routine);
    save();e.target.reset();renderRoutines();
    if(data.settings.notifications) scheduleNativeRoutine(routine);
    toast("Routine added.");
  };
  $("routineList").onclick=e=>{
    const id=Number(e.target.dataset.deleteRoutine);
    if(id){
      if(window.NavAIAndroid && window.NavAIAndroid.cancelReminder){
        for(let offset=0; offset<14; offset++){
          const d=new Date(); d.setDate(d.getDate()+offset);
          const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
          try{window.NavAIAndroid.cancelReminder(String(id)+"-"+key);}catch(error){}
        }
      }
      data.routines=data.routines.filter(r=>r.id!==id);save();renderRoutines();
    }
  };
  $("saveSettings").onclick=saveSettings;
  $("enableNotifications").onclick=async()=>{
    if(window.NavAIAndroid &&
       typeof window.NavAIAndroid.requestReminderPermissions === "function"){
      window.navaiPermissionRequestPending=true;
      window.NavAIAndroid.requestReminderPermissions();
      toast("Allow notification and exact alarm permissions for Saathi.");
      return;
    }

    if(!("Notification" in window)){
      toast("Browser notifications are unavailable here. Open Saathi in the NavAI Android app.");
      return;
    }

    const permission=await Notification.requestPermission();
    data.settings.notifications=permission==="granted";
    save();
    fillSettings();

    if(permission==="granted") syncNativeRoutineReminders();

    toast(permission==="granted"?"Browser notifications enabled.":"Permission not granted.");
  };
  $("moodResult").textContent=data.moods.length?"Last check-in: "+data.moods[data.moods.length-1].mood:"";
  document.querySelector(".mood-list").onclick=e=>{
    const b=e.target.closest("button[data-mood]");
    if(!b)return;
    const mood=b.dataset.mood;
    data.moods.push({mood,date:Date.now()});
    save();
    document.querySelectorAll(".mood-list button").forEach(x=>x.classList.toggle("selected",x===b));
    $("moodResult").textContent="Thanks for checking in. You can tell your Saathi more about it anytime.";
    toast("Check-in saved.");
  };
  document.querySelectorAll(".suggestions button").forEach(b=>b.addEventListener("click",()=>{}));
  scheduleCheck();
  syncNativeRoutineReminders();
  setInterval(scheduleCheck,10000);
}

// NAVAI_SMART_REMINDER_UPGRADE_V1
// Smart language, time greeting, AI message generation and one-notification voice loop.

const NAVAI_REMINDER_SEPARATOR = "\n---NAVAI-SAATHI-NEXT---\n";

function navaiReminderLanguage(){
  return getRoutineReminderLanguage();
}

function navaiReminderGreeting(language){
  const hour = new Date().getHours();

  if(language === "hindi"){
    if(hour >= 4 && hour < 12) return "सुप्रभात!";
    if(hour >= 12 && hour < 17) return "नमस्ते!";
    if(hour >= 17 && hour < 21) return "शुभ संध्या!";
    return "शुभ रात्रि!";
  }

  if(language === "english"){
    if(hour >= 4 && hour < 12) return "Good morning!";
    if(hour >= 12 && hour < 17) return "Hello!";
    if(hour >= 17 && hour < 21) return "Good evening!";
    return "Good night!";
  }

  if(hour >= 4 && hour < 12) return "Namaste! Good morning!";
  if(hour >= 12 && hour < 17) return "Namaste!";
  if(hour >= 17 && hour < 21) return "Namaste! Good evening!";
  return "Namaste! Good night!";
}

const NAVAI_REMINDER_ACTIVITIES = [
  {
    words: ["play","playing","game","gaming","khel","khelna","khelne","खेल","खेलना","खेलने","खेलकूद","cricket","football","badminton","basketball","hockey","tennis","outdoor","ground"],
    hindi: "खेलने",
    hinglish: "khelne",
    english: "play",
    lines: {
      hindi: ["खेलने का समय हो गया है। चलो, अब खेलने चलते हैं।","चलो, थोड़ा खेल लेते हैं।","तुम्हारा खेलने का समय है। तैयार हो जाओ।","अरे, खेलना है ना? चलो, अब चलते हैं।","अब खेल का समय है। चलो शुरू करते हैं।"],
      hinglish: ["Khelne ka time ho gaya hai. Chalo, ab khelne chalte hain.","Chalo, thoda khel lete hain.","Tumhara play time hai. Ready ho jao.","Arey, khelna hai na? Chalo ab chalte hain.","Ab game time hai. Chalo shuru karte hain."],
      english: ["It's time to play. Come on, let's go.","Let's enjoy some playtime.","Your playtime is here. Get ready.","Come on, it's time to play.","Let's get started with your game."]
    }
  },
  {
    words: ["wake","wakeup","getup","uth","uthna","uthne","जाग","जागना","उठ","उठना","उठने","morning walk"],
    hindi: "उठने",
    hinglish: "uthne",
    english: "wake up",
    lines: {
      hindi: ["उठने का समय हो गया है। चलो, अब उठ जाओ।","सुप्रभात! अब दिन की शुरुआत करते हैं।","चलो, बिस्तर छोड़ने का समय हो गया है।","अरे, अब उठ भी जाओ। दिन शुरू करते हैं।","चलो, आज का दिन अच्छे से शुरू करते हैं।"],
      hinglish: ["Uthne ka time ho gaya hai. Chalo, ab uth jao.","Good morning! Ab din shuru karte hain.","Chalo, bed se uthne ka time ho gaya.","Arey, ab uth bhi jao. Din shuru karte hain.","Chalo, aaj ka din achhe se shuru karte hain."],
      english: ["It's time to wake up. Come on, get up.","Good morning! Let's start the day.","Time to get out of bed.","Come on, let's get your day started.","Let's make a fresh start today."]
    }
  },
  {
    words: ["sleep","sleeping","bedtime","sona","sone","soja","सोना","सोने","नींद","rest at night"],
    hindi: "सोने",
    hinglish: "sone",
    english: "sleep",
    lines: {
      hindi: ["सोने का समय हो गया है। अब आराम करो।","चलो, अब दिन खत्म करके आराम करते हैं।","अब फोन रखकर सोने की तैयारी करो।","काफी हो गया, अब आराम का समय है।","शुभ रात्रि! अच्छे से आराम करना।"],
      hinglish: ["Sone ka time ho gaya hai. Ab aaram karo.","Chalo, ab din khatam karke rest karte hain.","Ab phone rakhkar sone ki taiyari karo.","Kaafi ho gaya, ab rest ka time hai.","Good night! Achhe se aaram karna."],
      english: ["It's bedtime. Time to get some rest.","Let's wind down and get some sleep.","Put your phone aside and get ready for bed.","It's time to rest now.","Good night! Sleep well."]
    }
  },
  {
    words: ["dinner","raat ka khana","night meal","डिनर","रात का खाना"],
    hindi: "रात का खाना खाने",
    hinglish: "dinner karne",
    english: "have dinner",
    lines: {
      hindi: ["रात का खाना खाने का समय हो गया है। चलो, खाना खा लो।","चलो, अब डिनर कर लेते हैं।","खाने का समय है। आराम से खाना खाओ।","अरे, डिनर तैयार है तो चलो खाना खाते हैं।","अब खाना खाने का समय है।"],
      hinglish: ["Dinner ka time ho gaya hai. Chalo, khana kha lo.","Chalo, ab dinner kar lete hain.","Khaane ka time hai. Aaram se khana khao.","Arey, dinner ka time hai. Chalo khate hain.","Ab dinner karne ka time hai."],
      english: ["It's dinner time. Come and have your meal.","Let's have dinner now.","It's time to sit down for dinner.","Come on, dinner time!","Time to have your evening meal."]
    }
  },
  {
    words: ["breakfast","nashta","nasta","सुबह का खाना","नाश्ता"],
    hindi: "नाश्ता करने",
    hinglish: "nashta karne",
    english: "have breakfast",
    lines: {
      hindi: ["नाश्ते का समय हो गया है। चलो, नाश्ता कर लो।","चलो, सुबह का नाश्ता कर लेते हैं।","दिन की शुरुआत नाश्ते से करते हैं।","अरे, नाश्ता करना मत भूलना।","अब कुछ खा लेने का समय है।"],
      hinglish: ["Nashta ka time ho gaya hai. Chalo, nashta kar lo.","Chalo, subah ka nashta kar lete hain.","Din ki shuruaat nashta karke karte hain.","Arey, nashta karna mat bhoolna.","Ab kuch kha lene ka time hai."],
      english: ["It's breakfast time. Come and eat.","Let's have breakfast.","Start your day with breakfast.","Don't forget your breakfast.","It's time to eat something."]
    }
  },
  {
    words: ["lunch","dopehar ka khana","दोपहर का खाना","लंच"],
    hindi: "दोपहर का खाना खाने",
    hinglish: "lunch karne",
    english: "have lunch",
    lines: {
      hindi: ["दोपहर के खाने का समय हो गया है। चलो, खाना खा लो।","चलो, अब लंच कर लेते हैं।","काम थोड़ी देर रोककर खाना खा लो।","खाने का समय है।","अब लंच करने चलते हैं।"],
      hinglish: ["Lunch ka time ho gaya hai. Chalo, khana kha lo.","Chalo, ab lunch kar lete hain.","Kaam thodi der rok kar khana kha lo.","Khaane ka time ho gaya hai.","Ab lunch karne chalte hain."],
      english: ["It's lunchtime. Come and eat.","Let's have lunch now.","Take a break and enjoy your lunch.","It's time for your midday meal.","Come on, let's have lunch."]
    }
  },
  {
    words: ["study","studying","padhai","padhna","पढ़ाई","पढ़ना","books","book reading","revision","revise","रिवीजन","अध्ययन"],
    hindi: "पढ़ाई करने",
    hinglish: "padhai karne",
    english: "study",
    lines: {
      hindi: ["पढ़ाई का समय हो गया है। चलो, शुरू करते हैं।","चलो, आज थोड़ा मन लगाकर पढ़ते हैं।","किताबें खोलने का समय हो गया है।","अब ध्यान से पढ़ाई शुरू करते हैं।","चलो, अपने लक्ष्य की तरफ एक कदम बढ़ाते हैं।"],
      hinglish: ["Padhai ka time ho gaya hai. Chalo, shuru karte hain.","Chalo, aaj thoda mann lagakar padhte hain.","Books kholne ka time ho gaya hai.","Ab focus ke saath padhai shuru karte hain.","Chalo, apne goal ki taraf ek step badhate hain."],
      english: ["It's study time. Let's get started.","Let's focus and study for a while.","Time to open your books.","Let's begin your study session.","One step closer to your goals. Let's study."]
    }
  },
  {
    words: ["homework","home work","गृहकार्य","होमवर्क","assignment","असाइनमेंट"],
    hindi: "होमवर्क करने",
    hinglish: "homework karne",
    english: "do your homework",
    lines: {
      hindi: ["होमवर्क करने का समय हो गया है। चलो शुरू करो।","चलो, आज का काम पूरा कर लेते हैं।","होमवर्क थोड़ा-थोड़ा करके पूरा करते हैं।","अब असाइनमेंट पर ध्यान देने का समय है।","चलो, काम पूरा करके फिर आराम करेंगे।"],
      hinglish: ["Homework ka time ho gaya hai. Chalo shuru karo.","Chalo, aaj ka kaam poora kar lete hain.","Homework thoda-thoda karke complete karte hain.","Ab assignment par focus karne ka time hai.","Chalo, kaam poora karke phir aaram karenge."],
      english: ["It's homework time. Let's begin.","Let's finish today's work.","Time to work on your homework.","Let's focus on your assignment.","Finish your work and then take a break."]
    }
  },
  {
    words: ["exercise","workout","gym","yoga","व्यायाम","कसरत","योग","running","jogging"," दौड़"," दौड़ना","walk","walking","टहलना","टहलने"],
    hindi: "व्यायाम करने",
    hinglish: "exercise karne",
    english: "exercise",
    lines: {
      hindi: ["व्यायाम का समय हो गया है। चलो, शुरुआत करते हैं।","थोड़ा चलने-फिरने का समय है।","चलो, आज की एक्सरसाइज कर लेते हैं।","अब शरीर को सक्रिय करने का समय है।","चलो, अपनी सुविधा के हिसाब से हल्की कसरत करते हैं।"],
      hinglish: ["Exercise ka time ho gaya hai. Chalo shuru karte hain.","Thoda walk karne ka time hai.","Chalo, aaj ki workout kar lete hain.","Ab body ko active karne ka time hai.","Chalo, apni comfort ke hisaab se exercise karte hain."],
      english: ["It's time to exercise. Let's get started.","Time for a little walk.","Let's do your planned workout.","Time to get moving.","Let's do some comfortable, gentle exercise."]
    }
  },
  {
    words: ["water","paani","पानी","drink water","hydrate","hydration","जल"],
    hindi: "पानी पीने",
    hinglish: "paani peene",
    english: "drink water",
    lines: {
      hindi: ["पानी पीने का समय है। थोड़ा पानी पी लो।","चलो, पानी पीना याद रखते हैं।","एक गिलास पानी पी लो।","पानी पास में रखो और थोड़ा पी लो।","अपना ध्यान रखना, पानी पी लेना।"],
      hinglish: ["Paani peene ka time hai. Thoda paani pee lo.","Chalo, paani peena yaad rakhte hain.","Ek glass paani pee lo.","Paani paas rakho aur thoda pee lo.","Apna dhyan rakhna, paani pee lena."],
      english: ["It's time to drink some water.","Remember to have some water.","Have a glass of water.","Keep some water nearby and take a drink.","Take care and remember to hydrate."]
    }
  },
  {
    words: ["brush","brushing","brush teeth","दांत साफ","दाँत साफ","ब्रश","toothbrush"],
    hindi: "दाँत साफ करने",
    hinglish: "brush karne",
    english: "brush your teeth",
    lines: {
      hindi: ["दाँत साफ करने का समय हो गया है।","चलो, अब ब्रश कर लो।","अपनी सुबह या रात की सफाई पूरी कर लो।","ब्रश करना मत भूलना।","चलो, अब दाँत साफ कर लेते हैं।"],
      hinglish: ["Brush karne ka time ho gaya hai.","Chalo, ab brush kar lo.","Apni morning ya night routine complete kar lo.","Brush karna mat bhoolna.","Chalo, ab teeth clean kar lete hain."],
      english: ["It's time to brush your teeth.","Come on, brush your teeth now.","Time for your dental routine.","Don't forget to brush.","Let's get your teeth clean."]
    }
  },
  {
    words: ["bath","bathing","shower","nahana","स्नान","नहाना","नहाने"],
    hindi: "नहाने",
    hinglish: "nahane",
    english: "take a bath",
    lines: {
      hindi: ["नहाने का समय हो गया है। चलो, तैयार हो जाओ।","चलो, अब नहा लेते हैं।","ताज़ा होने का समय है।","अब अपनी सफाई की दिनचर्या पूरी कर लो।","चलो, अब नहाने चलते हैं।"],
      hinglish: ["Nahane ka time ho gaya hai. Chalo ready ho jao.","Chalo, ab naha lete hain.","Fresh hone ka time hai.","Ab apni hygiene routine complete kar lo.","Chalo, ab nahane chalte hain."],
      english: ["It's time to take a bath.","Let's get ready for a shower.","Time to freshen up.","Time for your personal care routine.","Come on, let's get ready."]
    }
  },
  {
    words: ["school","school bus","स्कूल","विद्यालय","school jaana","school जाना"],
    hindi: "स्कूल जाने",
    hinglish: "school jaane",
    english: "go to school",
    lines: {
      hindi: ["स्कूल जाने का समय हो गया है। अपना बैग देख लो।","चलो, स्कूल के लिए तैयार हो जाओ।","अब निकलने की तैयारी करते हैं।","किताबें और जरूरी सामान रख लिया?","चलो, समय पर स्कूल चलते हैं।"],
      hinglish: ["School jaane ka time ho gaya hai. Bag check kar lo.","Chalo, school ke liye ready ho jao.","Ab nikalne ki taiyari karte hain.","Books aur zaroori samaan rakh liya?","Chalo, time par school chalte hain."],
      english: ["It's time to go to school. Check your bag.","Get ready for school.","Time to prepare to leave.","Have you packed your books and essentials?","Let's get to school on time."]
    }
  },
  {
    words: ["call","phone","mummy","mom","mother","मम्मी","माँ","मां","papa","dad","father","पापा","पिताजी","friend","दोस्त","दादी","नानी"],
    hindi: "फ़ोन करने",
    hinglish: "call karne",
    english: "make your call",
    lines: {
      hindi: ["फ़ोन करने का समय हो गया है। चलो, कॉल कर लो।","जिसे फ़ोन करना था, उसे कॉल कर लो।","चलो, अब बात कर लेते हैं।","तुम्हारी कॉल वाली याद दिलाने आया हूँ।","अब फ़ोन करने का सही समय है।"],
      hinglish: ["Call karne ka time ho gaya hai. Chalo, call kar lo.","Jise phone karna tha, unhe call kar lo.","Chalo, ab baat kar lete hain.","Tumhari call yaad dilane aaya hoon.","Ab phone karne ka time hai."],
      english: ["It's time to make your call.","Remember to call the person you planned to.","Let's make that call now.","Here's your reminder to make a call.","It's time for your planned phone call."]
    }
  },
  {
    words: ["clean","cleaning","room","safai","सफाई","कमरा","कमरे","tidy","organize","organise","dusting","laundry","कपड़े धोना","washing clothes"],
    hindi: "सफाई करने",
    hinglish: "safai karne",
    english: "clean up",
    lines: {
      hindi: ["सफाई का समय हो गया है। चलो, थोड़ा व्यवस्थित करते हैं।","चलो, अपना कमरा साफ कर लेते हैं।","थोड़ा-थोड़ा करके सब ठीक हो जाएगा।","अब सामान अपनी जगह रखने का समय है।","चलो, सफाई शुरू करते हैं।"],
      hinglish: ["Safai ka time ho gaya hai. Chalo, thoda organize karte hain.","Chalo, apna room saaf kar lete hain.","Thoda-thoda karke sab theek ho jayega.","Ab samaan apni jagah rakhne ka time hai.","Chalo, cleaning shuru karte hain."],
      english: ["It's time to tidy up.","Let's clean your room.","A little at a time will get it done.","Time to put things back in place.","Let's get started with cleaning."]
    }
  },
  {
    words: ["break","rest","आराम","विश्राम","ब्रेक","relax","relaxation"],
    hindi: "आराम करने",
    hinglish: "rest karne",
    english: "take a break",
    lines: {
      hindi: ["थोड़ा आराम करने का समय हो गया है।","चलो, कुछ देर का ब्रेक लेते हैं।","अपना काम रोककर थोड़ा आराम कर लो।","थोड़ी देर खुद को समय दो।","चलो, अब थोड़ा रिलैक्स करते हैं।"],
      hinglish: ["Thoda rest karne ka time ho gaya hai.","Chalo, kuch der ka break lete hain.","Kaam rok kar thoda aaram kar lo.","Thodi der khud ko time do.","Chalo, ab relax karte hain."],
      english: ["It's time to take a break.","Let's pause for a little while.","Take a moment to rest.","Give yourself a little time.","Let's relax for a bit."]
    }
  }
];

function navaiDetectReminderActivity(title){
  const value = String(title || "").toLowerCase().trim();
  for(const activity of NAVAI_REMINDER_ACTIVITIES){
    if(activity.words.some(word => value.includes(String(word).toLowerCase()))){
      return activity;
    }
  }
  return null;
}

function navaiLocalReminderMessages(title, language){
  const activity = navaiDetectReminderActivity(title);

  if(activity){
    return activity.lines[language] || activity.lines.hinglish;
  }

  const safeTitle = String(title || "your activity").trim().slice(0,120);

  if(language === "hindi"){
    return [
      "अब " + safeTitle + " का समय हो गया है। चलो, शुरू करते हैं।",
      "याद है ना, तुम्हें " + safeTitle + " करना था।",
      "चलो, अब " + safeTitle + " पर ध्यान देते हैं।",
      "तुम्हारा रिमाइंडर है। " + safeTitle + " कर लेना।",
      "अरे, अब " + safeTitle + " करने का समय है।"
    ];
  }

  if(language === "english"){
    return [
      "It's time for " + safeTitle + ". Let's get started.",
      "Just a reminder about " + safeTitle + ".",
      "Let's focus on " + safeTitle + " now.",
      "Don't forget your planned activity: " + safeTitle + ".",
      "Come on, it's time for " + safeTitle + "."
    ];
  }

  return [
    safeTitle + " ka time ho gaya hai. Chalo shuru karte hain.",
    "Yaad hai na, tumhe " + safeTitle + " karna tha.",
    "Chalo, ab " + safeTitle + " par focus karte hain.",
    "Tumhara reminder hai. " + safeTitle + " kar lena.",
    "Arey, ab " + safeTitle + " ka time hai."
  ];
}

function navaiGetRoutineMessages(routine){
  if(routine && Array.isArray(routine.reminderMessages) &&
     routine.reminderMessages.length >= 2){
    return routine.reminderMessages.slice(0,6);
  }

  return navaiLocalReminderMessages(
    routine && routine.title ? routine.title : routine,
    navaiReminderLanguage()
  );
}

async function navaiGenerateAIMessages(routine){
  if(!routine || !routine.title || routine._navaiAiPending ||
     routine._navaiAiDone) return;

  routine._navaiAiPending = true;

  try{
    const language = navaiReminderLanguage();
    const prompt =
      "Create exactly 5 short, natural, different reminder voice sentences. " +
      "The reminder title is: " + String(routine.title).slice(0,150) + ". " +
      "Interpret and translate the meaning of the title into the selected language. " +
      "Selected language: " + language + ". " +
      "Do not merely repeat the original English title if a natural translation exists. " +
      "For Hindi, use natural Hindi script. For Hinglish, use natural Roman Hinglish. " +
      "For English, use natural English. " +
      "Use warm, caring, family-like language, never romantic language. " +
      "Make each sentence different, with gentle variation in tone. " +
      "Do not include a time greeting; the app adds it at reminder time. " +
      "Do not invent facts or extra actions. " +
      "Return ONLY a JSON array of 5 strings.";

    const response = await fetch("/api/saathi/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        message:prompt,
        mode:"chat",
        context:"Generate reminder voice messages only.",
        history:[]
      })
    });

    if(!response.ok) throw new Error("AI request failed: " + response.status);

    const result = await response.json();
    let reply = String(result.reply || "").trim();

    reply = reply.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");

    const first = reply.indexOf("[");
    const last = reply.lastIndexOf("]");
    if(first < 0 || last <= first) throw new Error("AI did not return a JSON array.");

    const parsed = JSON.parse(reply.slice(first,last + 1));
    if(!Array.isArray(parsed)) throw new Error("Invalid AI messages.");

    const messages = parsed
      .filter(item => typeof item === "string")
      .map(item => item.trim())
      .filter(item => item.length > 2 && item.length < 240);

    if(messages.length < 3) throw new Error("Not enough AI messages.");

    routine.reminderMessages = messages.slice(0,6);
    routine._navaiAiDone = true;
    routine._navaiAiPending = false;

    save();

    // Update already scheduled future alarms with AI-generated messages.
    scheduleNativeRoutine(routine);
  }catch(error){
    routine._navaiAiPending = false;
    console.warn("NavAI reminder AI fallback is active:",error);
  }
}

function getRoutineReminderMessage(title){
  const language = navaiReminderLanguage();
  const messages = navaiLocalReminderMessages(title,language);
  return navaiReminderGreeting(language) + " " + messages[0];
}

function speakRoutineReminder(){
  const active = routineReminderState.active;
  if(!active) return;

  const messages = Array.isArray(active.messages) && active.messages.length
    ? active.messages
    : navaiLocalReminderMessages(active.title,navaiReminderLanguage());

  const index = active.messageIndex || 0;
  const language = navaiReminderLanguage();
  let message = messages[index % messages.length];

  if(index === 0){
    message = navaiReminderGreeting(language) + " " + message;
  }

  active.messageIndex = index + 1;

  const panel = createRoutineReminderPanel();
  const panelMessage = panel.querySelector("#navaiReminderMessage");
  if(panelMessage) panelMessage.textContent = message;

  if(!("speechSynthesis" in window) ||
     !("SpeechSynthesisUtterance" in window)){
    routineReminderState.timer = setTimeout(speakRoutineReminder,2500);
    return;
  }

  try{
    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(message);
    speech.lang = language === "hindi" ? "hi-IN" :
      language === "english" ? "en-IN" : "hi-IN";
    speech.rate = 0.92;
    speech.pitch = 1.03;

    if(typeof getPreferredSaathiVoice === "function"){
      const voice = getPreferredSaathiVoice();
      if(voice) speech.voice = voice;
    }

    const activeKey = active.key;

    const repeat = () => {
      if(!routineReminderState.active ||
         routineReminderState.active.key !== activeKey) return;

      routineReminderState.timer = setTimeout(() => {
        routineReminderState.timer = null;
        speakRoutineReminder();
      },1800);
    };

    speech.onend = repeat;
    speech.onerror = repeat;

    window.speechSynthesis.speak(speech);
  }catch(error){
    console.warn("Reminder voice error:",error);
    routineReminderState.timer = setTimeout(speakRoutineReminder,2500);
  }
}

function startRoutineReminder(routine,today){
  if(routineReminderState.active) return;

  const reminderKey =
    KEY + ".routineReminder." + routine.id + "." + today;

  if(localStorage.getItem(reminderKey) === "done") return;

  const messages = navaiGetRoutineMessages(routine);

  routineReminderState.active = {
    id:routine.id,
    title:String(routine.title),
    key:reminderKey,
    messages:messages,
    messageIndex:0
  };

  const panel = createRoutineReminderPanel();
  const message = panel.querySelector("#navaiReminderMessage");

  if(message){
    message.textContent =
      navaiReminderGreeting(navaiReminderLanguage()) + " " + messages[0];
  }

  // Only one browser notification is created for this reminder.
  notify(
    "NavAI Saathi - Routine reminder",
    navaiReminderGreeting(navaiReminderLanguage()) + " " + messages[0],
    "navai-routine-" + routine.id + "-" + today
  );

  speakRoutineReminder();
}

function scheduleNativeRoutine(routine){
  if(!window.NavAIAndroid ||
     typeof window.NavAIAndroid.scheduleReminder !== "function") return false;

  if(!routine || !routine.id || !routine.time || !routine.title) return false;

  const parts = routine.time.split(":").map(Number);
  if(parts.length !== 2 ||
     parts[0] < 0 || parts[0] > 23 ||
     parts[1] < 0 || parts[1] > 59) return false;

  const messages = navaiGetRoutineMessages(routine);
  const messagePayload = messages.join(NAVAI_REMINDER_SEPARATOR);
  const now = new Date();
  let scheduled = 0;

  for(let dayOffset = 0; dayOffset < 14; dayOffset++){
    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + dayOffset,
      parts[0],
      parts[1],
      0,
      0
    );

    if(target.getTime() <= Date.now() + 5000) continue;

    if(routine.repeat === "weekdays" &&
       (target.getDay() === 0 || target.getDay() === 6)) continue;

    const dateKey = target.getFullYear() + "-" +
      String(target.getMonth()+1).padStart(2,"0") + "-" +
      String(target.getDate()).padStart(2,"0");

    const nativeId = String(routine.id) + "-" + dateKey;

    try{
      window.NavAIAndroid.scheduleReminder(
        nativeId,
        String(routine.title),
        messagePayload,
        navaiReminderLanguage(),
        target.getTime()
      );
      scheduled++;
    }catch(error){
      console.error("Native reminder scheduling failed",error);
    }
  }

  // Schedule local messages immediately. AI can replace them later.
  if(!routine._navaiAiDone && !routine._navaiAiPending){
    navaiGenerateAIMessages(routine);
  }

  return scheduled > 0;
}
// END NAVAI_SMART_REMINDER_UPGRADE_V1


// Android permission result callback.
window.navaiPermissionRequestPending = false;

window.navaiNativePermissionsChanged = function(granted){
  const allowed = granted === true;
  const wasPending = window.navaiPermissionRequestPending;

  window.navaiPermissionRequestPending = false;

  data.settings.notifications = allowed;
  save();
  fillSettings();

  if(allowed){
    syncNativeRoutineReminders();
    if(wasPending) toast("Saathi notifications and exact alarms are enabled.");
  }else if(wasPending){
    toast("Please allow both notification and exact alarm permissions.");
  }
};
if("speechSynthesis" in window){window.speechSynthesis.onvoiceschanged=populateVoiceOptions;}
init();

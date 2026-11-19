
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
function getOpenAppCommand(transcript){
  const value = String(transcript || "")
    .toLowerCase()
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const openIntent =
    /\b(open|launch|start|chalao|khol|kholo|kholna)\b|खोलो|खोल|चालू करो|ओपन/i;

  if(!openIntent.test(value)) return null;

  if(/whats?app|व्हाट्स.?एप|व्हाट्सएप|व्हाट्स अप/i.test(value)){
    return "WhatsApp";
  }

  if(/youtube|यूट्यूब/i.test(value)){
    return "YouTube";
  }

  if(/calculator|कैलकुलेटर/i.test(value)){
    return "Calculator";
  }

  if(/chrome|क्रोम/i.test(value)){
    return "Chrome";
  }

  let name = value
    .replace(/^(please\s+)?(open|launch|start)\s+/i, "")
    .replace(/\s+(please\s+)?(open|launch|start|khol|kholo|kholna|chalao|open karo)$/i, "")
    .replace(/\s+(खोलो|खोल|खोलना|ओपन करो)$/i, "")
    .trim();

  return name || null;
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
    const transcript = e.results[0][0].transcript || "";
    const appName = getOpenAppCommand(transcript);

    if (
      appName &&
      window.NavAIAndroid &&
      typeof window.NavAIAndroid.openApp === "function"
    ) {
      const opened = window.NavAIAndroid.openApp(appName);

      if(opened){
        addMessage("user", transcript);
        const reply = "Theek hai, " + appName + " khol raha hoon.";
        addMessage("assistant", reply);
        speak(reply);
        $("chatInput").value = "";
        return;
      }
    }

    $("chatInput").value = transcript;
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
  const task = String(title || "").trim().toLowerCase();

  const messages = {
    wake: {
      hindi: "सुप्रभात…\n\nउठने का समय हो गया है ना… चलो, अब आराम से उठ जाओ। सुबह हो गई है।",
      hinglish: "सुप्रभात…\n\nउठने का समय हो गया है ना… चलो, अब आराम से उठ जाओ। सुबह हो गई है।",
      english: "Good morning… It's time to wake up. Take your time and get up gently."
    },
    sleep: {
      hindi: "सोने का समय हो गया है… चलो, अब आराम से सो जाओ।",
      hinglish: "सोने का समय हो गया है… चलो, अब आराम से सो जाओ।",
      english: "It's time to sleep… Let's get some good rest now."
    },
    food: {
      hindi: "खाने का समय हो गया है… चलो, अब थोड़ा खाना खा लो।",
      hinglish: "खाने का समय हो गया है… चलो, अब थोड़ा खाना खा लो।",
      english: "It's time to eat… Come on, have something to eat."
    },
    rest: {
      hindi: "अब थोड़ा आराम कर लो… आज थक गए होगे।",
      hinglish: "अब थोड़ा आराम कर लो… आज थक गए होगे।",
      english: "Take a little rest now… You must have had a tiring day."
    },
    gym: {
      hindi: "चलो, अब जिम चलने का समय हो गया है… आराम से तैयार हो जाओ।",
      hinglish: "चलो, अब जिम चलने का समय हो गया है… आराम से तैयार हो जाओ।",
      english: "It's time for the gym… Get ready at your own pace."
    },
    study: {
      hindi: "चलो, अब पढ़ाई शुरू करने का समय हो गया है… आराम से बैठो और शुरू करो।",
      hinglish: "चलो, अब पढ़ाई शुरू करने का समय हो गया है… आराम से बैठो और शुरू करो।",
      english: "It's time to study… Get comfortable and let's get started."
    },
    homework: {
      hindi: "अब होमवर्क करने का समय हो गया है… चलो, आराम से शुरू करो।",
      hinglish: "अब होमवर्क करने का समय हो गया है… चलो, आराम से शुरू करो।",
      english: "It's time for homework… Let's get started calmly."
    },
    school: {
      hindi: "स्कूल जाने का समय हो गया है… चलो, अब तैयार हो जाओ।",
      hinglish: "स्कूल जाने का समय हो गया है… चलो, अब तैयार हो जाओ।",
      english: "It's time for school… Come on, get ready."
    },
    water: {
      hindi: "पानी पीने का समय हो गया है… चलो, थोड़ा पानी पी लो।",
      hinglish: "पानी पीने का समय हो गया है… चलो, थोड़ा पानी पी लो।",
      english: "Time to drink some water… Have a little water."
    }
  };

  let category = "";

  if(/wake[\s-]*up|wakeup|wake|morning|get[\s-]*up|rise|uthna|uthne|utho|uth|subah|jago|jaago|उठ|जाग|सुबह/.test(task)){
    category = "wake";
  }else if(/sleep|bedtime|go to bed|sona|sone|सोना|सोने|नींद/.test(task)){
    category = "sleep";
  }else if(/breakfast|lunch|dinner|food|eat|meal|khana|khana khana|खाना|नाश्ता|भोजन/.test(task)){
    category = "food";
  }else if(/rest|relax|break|aaram|आराम|विश्राम/.test(task)){
    category = "rest";
  }else if(/gym|workout|exercise|व्यायाम|जिम|कसरत/.test(task)){
    category = "gym";
  }else if(/homework|assignment|होमवर्क|गृहकार्य/.test(task)){
    category = "homework";
  }else if(/study|studying|revision|padhai|पढ़ाई|अध्ययन/.test(task)){
    category = "study";
  }else if(/school|विद्यालय|स्कूल/.test(task)){
    category = "school";
  }else if(/water|drink water|paani|पानी/.test(task)){
    category = "water";
  }

  const selectedLanguage = messages[category];
  if(selectedLanguage){
    return selectedLanguage[language] || selectedLanguage.hinglish;
  }

  const safeTitle = String(title || "your activity").trim();

  if(language === "hindi"){
    return "अब " + safeTitle + " का समय है… चलो, आराम से शुरू करो।";
  }

  if(language === "english"){
    return "It's time for " + safeTitle + "… Take your time and get started.";
  }

  return "अब " + safeTitle + " का समय है… चलो, आराम से शुरू करो।";
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
    if(window.NavAIAndroid && window.NavAIAndroid.requestNotificationPermission){
      window.NavAIAndroid.requestNotificationPermission();
      data.settings.notifications=true;
      save();fillSettings();
      syncNativeRoutineReminders();
      toast("Android permission prompt opened. Allow notifications to receive reminders.");
      return;
    }
    if(!("Notification" in window)){toast("Browser notifications are unavailable here. Open Saathi in the NavAI Android app.");return;}
    const permission=await Notification.requestPermission();
    data.settings.notifications=permission==="granted";
    save();fillSettings();
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
if("speechSynthesis" in window){window.speechSynthesis.onvoiceschanged=populateVoiceOptions;}
init();

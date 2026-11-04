
"use strict";

const $ = id => document.getElementById(id);
const KEY = "navai.saathi.v1";

const defaults = {
  profile:{name:"",age:"",occupation:"",interests:"",schedule:"",goals:"",food:"",tone:"warm and friendly"},
  tasks:[],routines:[],moods:[],settings:{voice:false,notifications:false,auto:false,quietStart:"22:00",quietEnd:"07:00"},
  mode:"companion",messages:[]
};

let data = load();
let busy = false;
let recognition = null;

function load(){
  try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||"{}")};}
  catch{return structuredClone(defaults);}
}
function save(){localStorage.setItem(KEY,JSON.stringify(data));}
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
const modeNames={
  companion:"NavAI Saathi",care:"Caring guide",teacher:"Teacher",
  mentor:"Mentor",friend:"Best friend",manager:"Life manager"
};
function setMode(mode){
  data.mode=mode;save();
  $("chatModeName").textContent=modeNames[mode];
  document.querySelectorAll(".mode").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
  showView("chat");
}
function addMessage(role,text){
  data.messages.push({role,text,time:Date.now()});
  if(data.messages.length>100)data.messages=data.messages.slice(-100);
  save();
  renderMessages();
}
function renderMessages(){
  const el=$("messages");
  el.innerHTML=data.messages.map(m=>`
    <div class="message ${m.role==="user"?"user":"assistant"}">
      <div class="bubble">${escapeHTML(m.text)}</div>
    </div>`).join("");
  el.scrollTop=el.scrollHeight;
}
function loadChat(){
  if(data.messages.length)renderMessages();
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
function speak(text){
  if(!data.settings.voice||!("speechSynthesis" in window))return;
  speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang="en-IN";utterance.rate=1;
  speechSynthesis.speak(utterance);
}
function startVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast("Voice input is not supported in this browser.");return;}
  if(recognition){recognition.stop();recognition=null;return;}
  recognition=new SR();
  recognition.lang="en-IN";
  recognition.interimResults=false;
  recognition.onresult=e=>{
    $("chatInput").value=e.results[0][0].transcript;
    $("chatInput").focus();
  };
  recognition.onerror=()=>toast("Voice input could not start.");
  recognition.onend=()=>{recognition=null;$("voiceBtn").classList.remove("recording");};
  recognition.start();$("voiceBtn").classList.add("recording");
}
function fillProfile(){
  const p=data.profile;
  const fields={profileName:"name",profileAge:"age",profileOccupation:"occupation",profileInterests:"interests",profileSchedule:"schedule",profileGoals:"goals",profileFood:"food",profileTone:"tone"};
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
  save();toast("Settings saved.");
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
async function notify(title,body){
  if(!data.settings.notifications||!("Notification" in window)||Notification.permission!=="granted"||inQuietHours())return;
  new Notification(title,{body,icon:""});
}
function scheduleCheck(){
  const today=new Date().toDateString();
  const last=localStorage.getItem(KEY+".lastCheckin");
  if(data.settings.auto&&last!==today){
    const hour=new Date().getHours();
    if(hour>=8&&hour<11){
      localStorage.setItem(KEY+".lastCheckin",today);
      notify("NavAI Saathi","Good morning! What would you like to focus on today?");
    }
  }
}
function init(){
  updateProfile();loadChat();renderTasks();renderRoutines();fillSettings();

  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
  document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));

  $("newChat").onclick=()=>{
    data.messages=[];save();renderMessages();setMode("companion");
    addMessage("assistant","Hello! I'm here. What would you like to talk about?");
  };
  $("startChat").onclick=()=>setMode("companion");
  $("openProfile").onclick=()=>showView("memory");
  $("settingsBtn").onclick=()=>showView("settings");
  $("menuToggle").onclick=()=>$("sidebar").classList.toggle("open");
  $("viewTasks").onclick=()=>showView("tasks");
  $("addTask").onclick=()=>{showView("tasks");$("taskInput").focus();};
  $("chatForm").onsubmit=e=>{e.preventDefault();sendMessage($("chatInput").value);};
  $("voiceBtn").onclick=startVoice;
  $("clearChat").onclick=()=>{
    if(confirm("Clear this conversation?")){
      data.messages=[];save();renderMessages();
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
      food:$("profileFood").value.trim(),tone:$("profileTone").value
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
    data.routines.push({id:Date.now(),title:$("routineTitle").value.trim(),time:$("routineTime").value,repeat:$("routineRepeat").value});
    save();e.target.reset();renderRoutines();toast("Routine added.");
  };
  $("routineList").onclick=e=>{
    const id=Number(e.target.dataset.deleteRoutine);
    if(id){data.routines=data.routines.filter(r=>r.id!==id);save();renderRoutines();}
  };
  $("saveSettings").onclick=saveSettings;
  $("enableNotifications").onclick=async()=>{
    if(!("Notification" in window)){toast("Notifications are unavailable.");return;}
    const permission=await Notification.requestPermission();
    data.settings.notifications=permission==="granted";
    save();fillSettings();toast(permission==="granted"?"Notifications enabled.":"Permission not granted.");
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
  setInterval(scheduleCheck,60000);
}
init();

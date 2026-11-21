"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const STORE = "navai.saathi.voicefirst.v3";
  const LEGACY_KEYS = ["navai.saathi.voicefirst.v2", "navai.saathi.voicefirst.v1"];
  const DEFAULT = {
    profile: { name:"", language:"hinglish", about:"", interests:"", goals:"", routine:"", preferences:"", dates:"" },
    settings: { voice:true, wake:false, checkin:false, notifications:false, quietStart:"22:00", quietEnd:"07:00" },
    reminders: [], tasks: [], notes: [], chatHistory: [], pendingReminder: null
  };
  const PROFILE_FIELDS = { pName:"name", pLanguage:"language", pAbout:"about", pInterests:"interests", pGoals:"goals", pRoutine:"routine", pPreferences:"preferences", pDates:"dates" };
  const SETTING_FIELDS = { sVoice:"voice", sWake:"wake", sCheckin:"checkin", sNotifications:"notifications" };
  let state = loadState(), recognition = null, listening = false, busy = false, lastReply = "", toastTimer = 0;

  function freshDefault(){ return JSON.parse(JSON.stringify(DEFAULT)); }
  function loadState(){
    try {
      let raw = localStorage.getItem(STORE);
      if (!raw) for (const key of LEGACY_KEYS) { raw = localStorage.getItem(key); if (raw) break; }
      const saved = raw ? JSON.parse(raw) : {};
      return {
        ...freshDefault(), ...saved,
        profile:{...DEFAULT.profile,...(saved.profile||{})},
        settings:{...DEFAULT.settings,...(saved.settings||{})},
        reminders:Array.isArray(saved.reminders)?saved.reminders.filter(x=>x&&typeof x.id==="string"&&typeof x.title==="string"&&typeof x.time==="string"):[],
        tasks:Array.isArray(saved.tasks)?saved.tasks.filter(x=>x&&typeof x.id==="string"&&typeof x.title==="string").slice(0,100):[],
        notes:Array.isArray(saved.notes)?saved.notes.filter(x=>x&&typeof x.id==="string"&&typeof x.text==="string").slice(0,100):[],
        chatHistory:Array.isArray(saved.chatHistory)?saved.chatHistory.filter(x=>x&&["user","assistant"].includes(x.role)&&typeof x.content==="string").slice(-40):[]
      };
    } catch (error) { console.warn("Saathi data could not be loaded:",error); return freshDefault(); }
  }
  function saveState(){ try { localStorage.setItem(STORE,JSON.stringify(state)); return true; } catch(error) { console.error(error); toast("Could not save. Device storage may be full or disabled."); return false; } }
  function toast(message){ const node=$("toast"); node.textContent=message; node.classList.add("show"); window.clearTimeout(toastTimer); toastTimer=window.setTimeout(()=>node.classList.remove("show"),2800); }
  function escapeHTML(value){ return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function setStatus(message,mode="ready"){
    $("statusText").textContent=message; $("liveText").textContent=message;
    $("statusDot").classList.toggle("busy",mode!=="ready");
    $("orbStage").classList.toggle("listening",mode==="listening");
    $("orbStage").classList.toggle("thinking",mode==="thinking");
  }
  function pageName(page){ return ({home:"Home",day:"My day",memory:"Personal memory",reminders:"Reminders",phone:"Phone actions",settings:"Settings"})[page]||"Home"; }
  function showPage(page){
    const pages=["home","day","memory","reminders","phone","settings"];
    if(!pages.includes(page)) page="home";
    pages.forEach(name=>$(name+"Page").classList.toggle("hidden",name!==page));
    $("pageTitle").textContent=pageName(page);
    document.querySelectorAll(".nav-item[data-page]").forEach(button=>button.classList.toggle("active",button.dataset.page===page));
    closeMenu();
    if(page==="memory") { fillProfile(); renderNotes(); }
    if(page==="day") renderTasks();
    if(page==="reminders") renderReminders();
    if(page==="phone") updatePhoneStatus();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function closeMenu(){ $("sidebar").classList.remove("open"); $("scrim").classList.remove("show"); }
  function updateIdentity(){
    const name=state.profile.name.trim(); $("sideName").textContent=name||"Your Saathi";
    $("sideAvatar").textContent=(name[0]||"S").toUpperCase();
    $("greeting").innerHTML=`Hello${name?`, ${escapeHTML(name)}`:" there"} <span>âœ¦</span>`;
  }
  function fillProfile(){ for(const [id,key] of Object.entries(PROFILE_FIELDS)) $(id).value=state.profile[key]||""; }
  function saveProfile(event){
    event.preventDefault(); for(const [id,key] of Object.entries(PROFILE_FIELDS)) state.profile[key]=$(id).value.trim();
    saveState(); updateIdentity(); toast("Profile saved on this device.");
  }
  function fillSettings(){
    for(const [id,key] of Object.entries(SETTING_FIELDS)) $(id).checked=!!state.settings[key];
    $("sQuietStart").value=state.settings.quietStart||"22:00"; $("sQuietEnd").value=state.settings.quietEnd||"07:00";
    updateNotificationState();
  }
  function updateNotificationState(){
    const bridge=window.NavAIAndroid;
    if(bridge&&typeof bridge.hasReminderPermissions==="function"){
      try{
        const allowed=bridge.hasReminderPermissions();
        $("notificationState").textContent=allowed?"Android reminder permissions are available.":"Android reminder permissions are not fully enabled.";
        return;
      }catch(error){console.warn("Native permission check failed:",error);}
    }
    const permission=("Notification" in window)?Notification.permission:"unsupported";
    $("notificationState").textContent=permission==="granted"?"Website notifications are allowed. Keep this Saathi tab open for browser reminders.":permission==="denied"?"Notifications are blocked in browser settings.":permission==="unsupported"?"Browser notifications are not supported here. Use the Android app for scheduled alarms.":"Allow notifications to use reminders on this website.";
  }

  window.navaiNativePermissionsChanged = function(allowed){
    updateNotificationState();
    if(allowed) refreshDailyReminderQueue();
  };
  function saveSettings(){
    for(const [id,key] of Object.entries(SETTING_FIELDS)) state.settings[key]=$(id).checked;
    state.settings.quietStart=$("sQuietStart").value||"22:00"; state.settings.quietEnd=$("sQuietEnd").value||"07:00";
    const bridge=window.NavAIAndroid;
    if(state.settings.wake){
      if(bridge&&typeof bridge.startWakeWordListening==="function"){
        try{bridge.startWakeWordListening();}catch(error){console.warn(error);state.settings.wake=false;$("sWake").checked=false;toast("Android wake-word service could not be requested.");}
      } else { state.settings.wake=false; $("sWake").checked=false; toast("Wake word is available only in the supported Android app."); }
    } else if(bridge&&typeof bridge.stopWakeWordListening==="function"){
      try{bridge.stopWakeWordListening();}catch(error){console.warn(error);}
    }
    if(state.settings.notifications&&("Notification" in window)&&Notification.permission!=="granted"){
      state.settings.notifications=false; $("sNotifications").checked=false; toast("Choose Allow notifications first to grant browser permission.");
    }
    saveState(); updateNotificationState();
    if(state.settings.checkin) toast("Preference saved. Automated AI check-ins still need native scheduling support."); else toast("Settings saved.");
  }
  function languageCode(){ return state.profile.language==="english"?"en-IN":state.profile.language==="hindi"?"hi-IN":"hi-IN"; }
  function speak(text){
    if(!state.settings.voice||!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel(); const utterance=new SpeechSynthesisUtterance(String(text).slice(0,1800));
    utterance.lang=languageCode(); utterance.rate=1; utterance.pitch=1; window.speechSynthesis.speak(utterance);
  }
  function stopVoice(){ if(recognition&&listening){try{recognition.stop();}catch(error){console.warn(error);}} if("speechSynthesis" in window) window.speechSynthesis.cancel(); setStatus("Voice stopped"); }
  function setResponse(message,heard=""){
    const text=String(message||""); $("responseText").textContent=text; $("heardText").textContent=heard?`You said: â€œ${heard}â€`:"";
    $("responseTime").textContent=new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
    lastReply=text; $("repeatButton").disabled=!text; $("copyButton").disabled=!text;
  }
  function buildContext(){
    return {
      profile:state.profile,
      settings:{language:state.profile.language,spokenReplies:state.settings.voice,quietHours:{start:state.settings.quietStart,end:state.settings.quietEnd}},
      reminders:state.reminders.map(({id,title,time,repeat})=>({id,title,time,repeat})),
      tasks:state.tasks.map(({title,done})=>({title,done})),
      notes:state.notes.map(note=>note.text),
      currentTime:new Date().toLocaleString(),
      instructions:"Use saved profile information only when relevant. Be honest, concise, respectful and safe. Never claim a phone action, alarm, message or purchase is complete unless the device confirms it. Ask for explicit confirmation before sensitive actions. Do not claim that automated check-ins are active unless confirmed."
    };
  }
  function extractOpenApp(text){
    const match=String(text).match(/(?:\bopen\b|\blaunch\b|\bstart\b|\bkhol(?:o)?\b|\bchalao\b|à¤–à¥‹à¤²à¥‹)\s+(.+)/i);
    return match?match[1].replace(/\s+(app|application)$/i,"").trim():null;
  }
  function rememberExchange(userText,assistantText){
    const now=Date.now();
    state.chatHistory.push({role:"user",content:String(userText).slice(0,2000),at:now});
    state.chatHistory.push({role:"assistant",content:String(assistantText).slice(0,4000),at:now});
    state.chatHistory=state.chatHistory.slice(-40);
    saveState();
  }

  function handleReminderChat(message){
    const text=String(message||"").trim();
    let pending=state.pendingReminder;

    function reply(answer){
      setResponse(answer,text);
      rememberExchange(text,answer);
      speak(answer);
    }

    function askRepeat(){
      pending.step="repeat";
      state.pendingReminder=pending;
      saveState();
      const [h,m]=String(pending.time||"06:00").split(":").map(Number);
      const shown=new Date();shown.setHours(h,m||0,0,0);
      reply(`${shown.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})} ka reminder samajh gaya. Aaj ke liye set karun ya roz repeat karun?`);
    }

    function finishReminder(repeat){
      pending.repeat=repeat;
      const item={
        id:`r${Date.now()}`,
        title:pending.title||"Reminder",
        time:pending.time,
        repeat
      };

      const parts=item.time.split(":").map(Number);
      const now=new Date();
      const requested=new Date();
      requested.setHours(parts[0],parts[1],0,0);

      if(repeat==="once" && requested.getTime()<=now.getTime()){
        pending.step="tomorrow";
        state.pendingReminder=pending;
        saveState();
        reply(`Aaj ${item.time} ka time nikal chuka hai. Kya kal ${item.time} baje reminder set karun?`);
        return;
      }

      item.dueAt=nextOccurrence(item.time).getTime();
      const result=scheduleReminder(item);

      if(!result.ok){
        state.pendingReminder=pending;
        saveState();
        reply(result.message);
        return;
      }

      state.reminders.push(item);
      state.pendingReminder=null;
      saveState();
      renderReminders();

      const where=result.platform==="android"?"Android alarm":"website notification (keep this tab open)";
      reply(`Done! ${item.time} ka ${repeat==="daily"?"daily":"one-time"} reminder ${where} par schedule ho gaya.`);
    }

    if(pending && pending.step==="period"){
      let period=null;
      if(/\b(pm|shaam|evening|raat)\b/i.test(text))period="pm";
      else if(/\b(am|subah|morning)\b/i.test(text))period="am";

      if(!period){
        if(/cancel|chhodo|rehne do|mat set/i.test(text)){
          state.pendingReminder=null;saveState();
          reply("Theek hai, reminder cancel kar diya. Koi alarm set nahi hua.");
          return true;
        }
        reply("Bas confirm kar dijiye: 6 AM (subah) ya 6 PM (shaam)?");
        return true;
      }

      let hour=pending.hour;
      if(period==="pm" && hour<12)hour+=12;
      if(period==="am" && hour===12)hour=0;
      pending.time=`${String(hour).padStart(2,"0")}:${String(pending.minute||0).padStart(2,"0")}`;
      askRepeat();
      return true;
    }

    if(pending && pending.step==="repeat"){
      if(/\b(aaj|sirf aaj|once|one.?time|ek baar)\b/i.test(text)){
        finishReminder("once");
        return true;
      }
      if(/\b(roz|daily|har din|every day|everyday)\b/i.test(text)){
        finishReminder("daily");
        return true;
      }
      if(/cancel|chhodo|rehne do|mat set/i.test(text)){
        state.pendingReminder=null;saveState();
        reply("Theek hai, reminder cancel kar diya. Koi alarm set nahi hua.");
        return true;
      }
      reply("Aaj ke liye one-time reminder chahiye ya roz daily repeat karna hai?");
      return true;
    }

    if(pending && pending.step==="tomorrow"){
      if(/\b(haan|yes|kal|tomorrow|set karo|kar do)\b/i.test(text)){
        finishReminder("once");
        return true;
      }
      if(/\b(nahi|no|cancel|rehne do)\b/i.test(text)){
        state.pendingReminder=null;saveState();
        reply("Theek hai, reminder cancel kar diya.");
        return true;
      }
      reply("Kya kal isi time reminder set kar doon? Haan ya nahi bata dijiye.");
      return true;
    }

    if(pending)return false;

    if(!/\b(remind(?:er)?|yaad dil|alarm)\b/i.test(text))return false;

    const ampm=text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    const baje=text.match(/\b(\d{1,2})(?::(\d{2}))?\s*baje\b/i);
    const clock=text.match(/\b(\d{1,2}):(\d{2})\b/);
    const match=ampm||baje||clock;
    if(!match)return false;

    let hour=Number(match[1]),minute=Number(match[2]||0);
    const period=ampm?(ampm[3]||"").toLowerCase():null;
    if(minute>59||hour>23||(period&&(hour<1||hour>12)))return false;

    pending={title:"Reminder",hour,minute,time:null,step:"period",repeat:null};
    state.pendingReminder=pending;
    saveState();

    if(period){
      if(period==="pm"&&hour<12)hour+=12;
      if(period==="am"&&hour===12)hour=0;
      pending.time=`${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;
      askRepeat();
    }else if(hour===0||hour>12){
      pending.time=`${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;
      askRepeat();
    }else{
      reply(`${hour} baje se aapka matlab subah ${hour} AM hai ya shaam ${hour} PM?`);
    }

    return true;
  }

  async function askSaathi(raw){
    const message=String(raw||"").trim(); if(!message||busy) return;
    if(message.length>2000){toast("Please keep your message under 2,000 characters.");return;}
    if(handleReminderChat(message))return;

    // Preserve the original request when the user answers a clarification.
    const requestMessage = (() => {
      const history = Array.isArray(state.chatHistory) ? state.chatHistory : [];
      const lastAssistantIndex = history.map(x => x.role).lastIndexOf("assistant");
      if (lastAssistantIndex < 0) return message;

      const previousAssistant = String(history[lastAssistantIndex].content || "");
      const previousUser = [...history.slice(0, lastAssistantIndex)]
        .reverse().find(x => x.role === "user");
      if (!previousUser) return message;

      const askedRepeat = /aaj ke liye|roz|daily|one.?time|once|repeat|हर दिन|रोज़|आज के लिए/i.test(previousAssistant);
      const isRepeatAnswer = /^(aaj ke liye|sirf aaj|आज के लिए|एक बार|ek baar|once|one.?time|roz|daily|har din|रोज़|हर दिन)[.! ]*$/i.test(message);

      if (!askedRepeat || !isRepeatAnswer) return message;

      return "CONTEXT: The user is answering your previous clarification. " +
        "Their original request was: " + String(previousUser.content) +
        ". Your previous question was: " + previousAssistant +
        ". Their answer is: " + message +
        ". Continue the ORIGINAL request using all its details. Do not ask what the answer refers to. " +
        "If any genuinely necessary detail is still missing, ask only for that detail.";
    })();
    busy=true; $("talkButton").disabled=true; $("commandInput").disabled=true; setStatus("Thinkingâ€¦","thinking"); setResponse("Saathi is thinkingâ€¦",message);
    try{
      const appName=extractOpenApp(message),bridge=window.NavAIAndroid;
      if(appName&&bridge&&typeof bridge.openApp==="function"){
        const opened=bridge.openApp(appName); const reply=opened?`Opening ${appName}.`:`I couldn't find ${appName} on this phone.`;
        setResponse(reply,message); rememberExchange(message,reply); speak(reply); return;
      }
      const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),30000);
      let response;
      try{response=await fetch("/api/saathi/chat",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",signal:controller.signal,body:JSON.stringify({message:requestMessage,mode:"companion",context:buildContext(),history:state.chatHistory.slice(-12).map(entry=>({role:entry.role,content:entry.content}))})});}
      finally{window.clearTimeout(timeout);}
      let payload; try{payload=await response.json();}catch(error){throw new Error("The assistant service returned an unreadable response.");}
      if(!response.ok) throw new Error(payload.error||`Assistant service returned ${response.status}.`);
      const reply=typeof payload.reply==="string"?payload.reply:typeof payload.response==="string"?payload.response:typeof payload.message==="string"?payload.message:"I received an empty response. Please try again.";
      setResponse(reply,message); rememberExchange(message,reply); speak(reply);
    }catch(error){
      console.error("Saathi request failed:",error); const detail=error.name==="AbortError"?"The request took too long. Please try again.":error.message||"Check your internet connection and try again.";
      setResponse(`I couldn't complete that request. ${detail}`,message); toast("Assistant connection issue");
    }finally{busy=false;$("talkButton").disabled=false;$("commandInput").disabled=false;setStatus(listening?"Listeningâ€¦":"Ready when you are",listening?"listening":"ready");}
  }
  function startListening(){
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SpeechRecognition){toast("Voice input is not supported in this browser. Try the supported Android app or type below.");return;}
    if(busy){toast("Please wait for the current response.");return;}
    if(listening&&recognition){try{recognition.stop();}catch(error){console.warn(error);}return;}
    recognition=new SpeechRecognition(); recognition.lang=languageCode(); recognition.interimResults=true; recognition.maxAlternatives=1; recognition.continuous=false;
    recognition.onstart=()=>{listening=true;$("talkLabel").textContent="Listeningâ€¦";setStatus("Listeningâ€¦","listening");};
    recognition.onresult=event=>{
      let interim="",finalText="";
      for(let i=event.resultIndex;i<event.results.length;i++){const transcript=event.results[i][0].transcript;if(event.results[i].isFinal)finalText+=transcript;else interim+=transcript;}
      if(interim)setResponse(`Listening: ${interim}`); if(finalText.trim())askSaathi(finalText.trim());
    };
    recognition.onerror=event=>{console.warn("Speech recognition:",event.error);if(event.error!=="no-speech"&&event.error!=="aborted")toast(`Microphone: ${event.error}`);};
    recognition.onend=()=>{listening=false;$("talkLabel").textContent="Tap to speak";if(!busy)setStatus("Ready when you are");};
    try{recognition.start();}catch(error){console.warn(error);toast("Voice input could not start. Check microphone permission.");}
  }
  function renderTasks(){
    const list=$("taskList"),done=state.tasks.filter(task=>task.done).length,total=state.tasks.length;
    $("taskProgress").textContent=`${done} / ${total}`; $("taskRemaining").textContent=String(total-done);
    $("taskProgressBar").style.width=total?`${Math.round(done/total*100)}%`:"0%";
    if(!total){list.innerHTML='<div class="empty-state">Your day is open. Add your first priority above.</div>';return;}
    list.replaceChildren();
    state.tasks.forEach(task=>{
      const row=document.createElement("div");row.className="task-row";
      const label=document.createElement("label");label.className="task-label";
      const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.checked=!!task.done;checkbox.addEventListener("change",()=>{task.done=checkbox.checked;saveState();renderTasks();});
      const title=document.createElement("span");title.textContent=task.title;if(task.done)title.classList.add("completed");label.append(checkbox,title);
      const remove=document.createElement("button");remove.type="button";remove.className="remove-button";remove.textContent="Remove";remove.addEventListener("click",()=>{state.tasks=state.tasks.filter(item=>item.id!==task.id);saveState();renderTasks();});
      row.append(label,remove);list.append(row);
    });
  }
  function addTask(event){event.preventDefault();const title=$("taskInput").value.trim();if(!title)return;state.tasks.push({id:`t${Date.now()}`,title,done:false,createdAt:Date.now()});saveState();$("taskInput").value="";renderTasks();toast("Added to today's priorities.");}
  function renderNotes(){
    const list=$("memoryNotes");if(!state.notes.length){list.innerHTML='<div class="empty-state">No personal notes saved yet.</div>';return;}
    list.replaceChildren();state.notes.forEach(note=>{const row=document.createElement("div");row.className="note-row";const text=document.createElement("span");text.textContent=note.text;const remove=document.createElement("button");remove.type="button";remove.className="remove-button";remove.textContent="Remove";remove.addEventListener("click",()=>{state.notes=state.notes.filter(item=>item.id!==note.id);saveState();renderNotes();});row.append(text,remove);list.append(row);});
  }
  function addNote(event){event.preventDefault();const text=$("noteInput").value.trim();if(!text)return;state.notes.unshift({id:`n${Date.now()}`,text});state.notes=state.notes.slice(0,100);saveState();$("noteInput").value="";renderNotes();toast("Personal note saved on this device.");}
  function exportData(){
    const data={app:"NavAI Saathi",version:3,exportedAt:new Date().toISOString(),data:state};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob);
    const link=document.createElement("a");link.href=url;link.download="navai-saathi-personal-data.json";document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1500);toast("Your data export is ready.");
  }
  function clearPersonalData(){
    if(!window.confirm("Clear your profile, personal notes and today's tasks from this device? Reminders and settings will stay."))return;
    state.profile={...DEFAULT.profile};state.notes=[];state.tasks=[];saveState();updateIdentity();fillProfile();renderNotes();renderTasks();toast("Personal profile, notes and tasks cleared locally.");
  }
  function nextOccurrence(time){const [hours,minutes]=time.split(":").map(Number);const date=new Date();date.setHours(hours,minutes,0,0);if(date.getTime()<=Date.now())date.setDate(date.getDate()+1);return date;}
  function scheduleReminder(item){
    const bridge=window.NavAIAndroid;
    if(bridge&&typeof bridge.scheduleReminder==="function"){
      try{
        let scheduled=false;
        if(item.repeat==="daily"&&typeof bridge.scheduleDailyReminder==="function"){
          const [hour,minute]=item.time.split(":").map(Number);
          scheduled=bridge.scheduleDailyReminder(item.id,item.title,`Reminder: ${item.title}`,languageCode(),hour,minute)===true;
        }else{
          const when=item.dueAt?new Date(item.dueAt):nextOccurrence(item.time);
          scheduled=bridge.scheduleReminder(item.id,item.title,`Reminder: ${item.title}`,languageCode(),when.getTime())===true;
        }
        return scheduled?{ok:true,platform:"android"}:{ok:false,message:"Android did not confirm the alarm. Check notification and exact-alarm permissions; reminder was not saved."};
      }catch(error){
        console.warn("Native reminder scheduling failed for",item.id,error);
        return {ok:false,message:"Android could not schedule this alarm. Check app permissions and try again."};
      }
    }
    if(!("Notification" in window)||Notification.permission!=="granted"){
      return {ok:false,message:"Website reminders need notification permission. Open Settings → Allow notifications, then try again. The website must stay open for reminders."};
    }
    return {ok:true,platform:"browser"};
  }
  function cancelNativeReminder(item){
    const bridge=window.NavAIAndroid;if(!bridge||typeof bridge.cancelReminder!=="function")return;
    try{bridge.cancelReminder(item.id);}catch(error){console.warn(error);}
  }
  function fireBrowserReminder(item){
    if(!("Notification" in window)||Notification.permission!=="granted")return false;
    try{
      const notification=new Notification(item.title,{body:`NavAI Saathi reminder: ${item.title}`,tag:`navai-${item.id}`,renotify:false});
      notification.onclick=()=>{window.focus();showPage("reminders");notification.close();};
      if(state.settings.voice&&document.visibilityState==="visible")speak(`Reminder. ${item.title}`);
      return true;
    }catch(error){console.warn("Browser reminder notification failed:",error);return false;}
  }
  function checkBrowserReminders(){
    if(window.NavAIAndroid&&typeof window.NavAIAndroid.scheduleReminder==="function")return;
    if(!( "Notification" in window)||Notification.permission!=="granted")return;
    const now=new Date(),today=now.toLocaleDateString("en-CA");
    let changed=false;
    state.reminders=[...state.reminders].filter(item=>{
      if(item.repeat==="daily"){
        const [h,m]=item.time.split(":").map(Number);
        const firstDue=Number(item.dueAt)||0;
        if(now.getTime()>=firstDue&&now.getHours()*60+now.getMinutes()>=h*60+m&&item.lastFiredDate!==today){
          if(fireBrowserReminder(item)){item.lastFiredDate=today;changed=true;}
        }
        return true;
      }
      const due=Number(item.dueAt)||nextOccurrence(item.time).getTime();
      if(now.getTime()>=due){
        if(now.getTime()-due>24*60*60*1000){changed=true;return false;}
        if(!fireBrowserReminder(item))return true;
        changed=true;
        return false;
      }
      return true;
    });
    if(changed){saveState();renderReminders();}
  }
  function renderReminders(){
    const list=$("reminderList");$("reminderCount").textContent=String(state.reminders.length);$("reminderCountPill").textContent=String(state.reminders.length);
    if(!state.reminders.length){list.innerHTML='<div class="empty-state">No reminders yet. Add one above.</div>';$ ("nextReminder").textContent="Nothing scheduled";return;}
    const sorted=[...state.reminders].map(item=>({item,when:nextOccurrence(item.time)})).sort((a,b)=>a.when-b.when);$("nextReminder").textContent=sorted[0].when.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
    list.replaceChildren();sorted.forEach(item=>{
      const row=document.createElement("div");row.className="reminder-row";const info=document.createElement("div");info.className="reminder-info";
      const icon=document.createElement("span");icon.className="reminder-icon";icon.textContent="â—·";const copy=document.createElement("div");const title=document.createElement("b");title.textContent=item.title;const meta=document.createElement("small");meta.textContent=`${item.time} Â· ${item.repeat==="daily"?"Daily":"One time"}`;copy.append(title,meta);info.append(icon,copy);
      const remove=document.createElement("button");remove.type="button";remove.className="remove-button";remove.textContent="Remove";remove.addEventListener("click",()=>removeReminder(item.id));row.append(info,remove);list.append(row);
    });
  }
  function addReminder(event){
    event.preventDefault();const title=$("rTitle").value.trim(),time=$("rTime").value,repeat=$("rRepeat").value;
    if(!title||!time){toast("Enter a title and time first.");return;}
    const item={id:`r${Date.now()}`,title,time,repeat,dueAt:nextOccurrence(time).getTime()};
    const result=scheduleReminder(item);
    if(!result.ok){toast(result.message);return;}
    state.reminders.push(item);saveState();renderReminders();$("reminderForm").reset();
    toast(result.platform==="android"?"Android confirmed the reminder alarm.":"Website reminder saved. Keep this tab open until it fires.");
    if(result.platform==="browser")checkBrowserReminders();
  }
  function removeReminder(id){const item=state.reminders.find(reminder=>reminder.id===id);if(item)cancelNativeReminder(item);state.reminders=state.reminders.filter(reminder=>reminder.id!==id);saveState();renderReminders();toast("Removed from the saved reminder list.");}
  async function allowNotifications(){
    const bridge=window.NavAIAndroid;
    if(bridge&&typeof bridge.requestReminderPermissions==="function"){
      try{
        bridge.requestReminderPermissions();
        updateNotificationState();
        toast("Android reminder permission requested. Allow access in Android settings if prompted.");
        return;
      }catch(error){console.warn("Android permission request failed:",error);}
    }
    if(!("Notification" in window)){toast("Notifications are not supported in this browser.");return;}
    try{const permission=await Notification.requestPermission();state.settings.notifications=permission==="granted";$("sNotifications").checked=state.settings.notifications;saveState();updateNotificationState();if(permission==="granted")checkBrowserReminders();toast(permission==="granted"?"Website notifications allowed. Keep this tab open for browser reminders.":"Notification permission was not granted.");}
    catch(error){console.warn(error);toast("Could not request notification permission.");}
  }
  function updatePhoneStatus(){
    const connected=!!(window.NavAIAndroid&&typeof window.NavAIAndroid.openApp==="function");
    const box=$("phoneStatus");box.classList.toggle("connected",connected);
    box.querySelector("b").textContent=connected?"Android app bridge detected":"Android app bridge not detected";
    box.querySelector("small").textContent=connected?"App shortcuts can request supported apps to open.":"Open this page inside the NavAI Android app to use app shortcuts.";
  }
  function openPhoneApp(name){
    const bridge=window.NavAIAndroid;
    if(!bridge||typeof bridge.openApp!=="function"){toast("This action is available only inside the supported NavAI Android app.");return;}
    try{const opened=bridge.openApp(name);toast(opened?`Opening ${name}.`:`Couldn't find ${name} on this phone.`);}
    catch(error){console.warn(error);toast(`Could not open ${name}.`);}
  }
  function refreshDailyReminderQueue(){
    // Rebuild the next 14 days whenever Saathi is opened. The Android bridge does not yet expose an automatic rescheduler.
    const bridge=window.NavAIAndroid;if(!bridge||typeof bridge.scheduleReminder!=="function")return;
    state.reminders.filter(item=>item.repeat==="daily").forEach(item=>{
      const first=nextOccurrence(item.time);
      for(let i=0;i<14;i++){const when=new Date(first);when.setDate(first.getDate()+i);const id=i===0?item.id:`${item.id}-d${i}`;try{bridge.scheduleReminder(id,item.title,`Reminder: ${item.title}`,languageCode(),when.getTime());}catch(error){console.warn("Reminder refresh failed:",error);break;}}
    });
  }
  function init(){
    updateIdentity();fillSettings();$("todayLabel").textContent=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});$("dayDateBadge").textContent=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"}).toUpperCase();
    document.querySelectorAll("[data-page]").forEach(button=>button.addEventListener("click",()=>showPage(button.dataset.page)));
    document.querySelectorAll("[data-go]").forEach(button=>button.addEventListener("click",()=>showPage(button.dataset.go)));
    document.querySelectorAll("[data-prompt]").forEach(button=>button.addEventListener("click",()=>{showPage("home");askSaathi(button.dataset.prompt);}));
    $("menuButton").addEventListener("click",()=>{$("sidebar").classList.toggle("open");$("scrim").classList.toggle("show");});$("scrim").addEventListener("click",closeMenu);
    $("talkButton").addEventListener("click",startListening);$("stopButton").addEventListener("click",stopVoice);
    $("commandForm").addEventListener("submit",event=>{event.preventDefault();const value=$("commandInput").value.trim();if(value){$("commandInput").value="";askSaathi(value);}});
    $("profileForm").addEventListener("submit",saveProfile);$("taskForm").addEventListener("submit",addTask);$("noteForm").addEventListener("submit",addNote);$("reminderForm").addEventListener("submit",addReminder);
    $("clearCompleted").addEventListener("click",()=>{state.tasks=state.tasks.filter(task=>!task.done);saveState();renderTasks();});
    $("saveSettings").addEventListener("click",saveSettings);$("allowNotifications").addEventListener("click",allowNotifications);
    $("clearMemory").addEventListener("click",clearPersonalData);$("exportData").addEventListener("click",exportData);$("exportSettings").addEventListener("click",exportData);
    $("clearAllData").addEventListener("click",()=>{if(!window.confirm("Clear ALL NavAI Saathi data saved in this browser, including reminders and settings?"))return;state.reminders.forEach(cancelNativeReminder);state=freshDefault();saveState();updateIdentity();fillProfile();fillSettings();renderNotes();renderTasks();renderReminders();toast("All local Saathi data cleared. Android cancellation requests were sent where supported.");});
    $("repeatButton").addEventListener("click",()=>speak(lastReply));$("copyButton").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(lastReply);toast("Response copied.");}catch(error){toast("Clipboard permission is not available.");}});
    document.querySelectorAll("[data-app]").forEach(button=>button.addEventListener("click",()=>openPhoneApp(button.dataset.app)));
    renderTasks();renderNotes();renderReminders();updatePhoneStatus();refreshDailyReminderQueue();
    checkBrowserReminders();window.setInterval(checkBrowserReminders,10000);
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")checkBrowserReminders();});
    const lastAssistant=state.chatHistory[state.chatHistory.length-1];
    const lastUser=state.chatHistory[state.chatHistory.length-2];
    if(lastAssistant&&lastAssistant.role==="assistant"){
      setResponse(lastAssistant.content,lastUser&&lastUser.role==="user"?lastUser.content:"");
    } else if(!state.profile.name){
      setResponse("Welcome to NavAI Saathi. Add your details in Personal memory, then tap the microphone to talk.");
    }
    // Migrate legacy local data to the V3 key without deleting the old copy.
    if(!localStorage.getItem(STORE))saveState();
  }
  document.addEventListener("DOMContentLoaded",init,{once:true});
})();

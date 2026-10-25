(() => {
"use strict";
const KEY = "navai.studyPlanner.v1";
const $ = id => document.getElementById(id);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const safeRead = () => {
  try {
    const x = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {tasks:Array.isArray(x.tasks)?x.tasks:[], chapters:Array.isArray(x.chapters)?x.chapters:[]};
  } catch { return {tasks:[],chapters:[]}; }
};
let data = safeRead();
const persist = () => {
  try { localStorage.setItem(KEY,JSON.stringify(data)); }
  catch { alert("Browser storage full hai. Kuch purane planner records delete karke dobara try karo."); }
};
const escapeHTML = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const prettyDate = s => {
  if(!s) return "No date";
  const d = new Date(s+"T12:00:00");
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
};
$("todayDate").textContent = new Date().toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short",year:"numeric"});
$("studyDate").value = today();
$("studyDate").min = today();

$("planForm").addEventListener("submit",e=>{
  e.preventDefault();
  const subject=$("subject").value.trim(), topic=$("topic").value.trim();
  if(!subject||!topic) return;
  data.tasks.unshift({
    id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random(),
    subject,topic,date:$("studyDate").value||today(),
    duration:Number($("duration").value)||25,
    priority:$("priority").value,done:false,created:Date.now()
  });
  persist(); $("topic").value=""; render();
});
$("filter").addEventListener("change",render);
function render(){
  const done=data.tasks.filter(t=>t.done).length, total=data.tasks.length;
  const pct=total?Math.round(done/total*100):0;
  $("doneCount").textContent=done; $("taskCount").textContent=total;
  $("progressPct").textContent=pct+"%"; $("ringPct").textContent=pct+"%";
  $("sideDone").textContent=done; $("sidePending").textContent=total-done;
  $("progressRing").style.setProperty("--pct",pct+"%");
  const filter=$("filter").value;
  const tasks=data.tasks.filter(t=>filter==="today"?t.date===today():filter==="pending"?!t.done:filter==="done"?t.done:true);
  $("taskList").innerHTML=tasks.map(t=>`
    <article class="task ${t.done?"done":""}">
      <input class="task-check" type="checkbox" aria-label="Mark ${escapeHTML(t.topic)} complete" data-check="${escapeHTML(t.id)}" ${t.done?"checked":""}>
      <div class="task-body"><div class="task-name">${escapeHTML(t.topic)}</div>
        <div class="task-meta"><span class="tag">${escapeHTML(t.subject)}</span><span class="tag">${prettyDate(t.date)}</span><span class="tag">${t.duration} min</span><span class="tag ${t.priority==="High"?"high":t.priority==="Important"?"important":""}">${escapeHTML(t.priority)}</span></div>
      </div>
      <button type="button" class="delete" data-delete="${escapeHTML(t.id)}" aria-label="Delete task">✕</button>
    </article>`).join("");
  $("emptyState").hidden=tasks.length>0;
  $("taskList").querySelectorAll("[data-check]").forEach(el=>el.addEventListener("change",()=>{
    const t=data.tasks.find(t=>t.id===el.dataset.check); if(t){t.done=el.checked;persist();render();}
  }));
  $("taskList").querySelectorAll("[data-delete]").forEach(el=>el.addEventListener("click",()=>{
    if(confirm("Delete this study task?")){data.tasks=data.tasks.filter(t=>t.id!==el.dataset.delete);persist();render();}
  }));
  renderChapters();
}
$("syllabusForm").addEventListener("submit",e=>{
  e.preventDefault();
  const subject=$("syllabusSubject").value.trim(),topic=$("syllabusTopic").value.trim();
  if(!subject||!topic)return;
  if(data.chapters.some(c=>c.subject.toLowerCase()===subject.toLowerCase()&&c.topic.toLowerCase()===topic.toLowerCase())){
    alert("Ye chapter pehle se syllabus tracker mein hai.");return;
  }
  data.chapters.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),subject,topic,status:"Not started"});
  persist();$("syllabusTopic").value="";renderChapters();
});
function renderChapters(){
  $("syllabusList").innerHTML=data.chapters.map(c=>`
    <div class="chapter"><div class="chapter-top"><span>${escapeHTML(c.topic)}</span><button class="delete" type="button" data-chdelete="${escapeHTML(c.id)}" aria-label="Delete chapter">✕</button></div>
    <small>${escapeHTML(c.subject)}</small>
    <select data-status="${escapeHTML(c.id)}" aria-label="Chapter status">
      ${["Not started","Learning","Needs revision","Completed"].map(s=>`<option ${c.status===s?"selected":""}>${s}</option>`).join("")}
    </select></div>`).join("");
  $("syllabusList").querySelectorAll("[data-status]").forEach(el=>el.addEventListener("change",()=>{
    const c=data.chapters.find(c=>c.id===el.dataset.status);if(c){c.status=el.value;persist();}
  }));
  $("syllabusList").querySelectorAll("[data-chdelete]").forEach(el=>el.addEventListener("click",()=>{
    if(confirm("Remove this chapter from your tracker?")){data.chapters=data.chapters.filter(c=>c.id!==el.dataset.chdelete);persist();renderChapters();}
  }));
}
render();
})();
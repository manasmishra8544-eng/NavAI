const $ = id => document.getElementById(id);
let lastDetails = null;

function collectDetails(){
  const details = {
    school: {start:$("schoolStart").value,end:$("schoolEnd").value},
    coaching:{start:$("coachingStart").value,end:$("coachingEnd").value},
    gym:{start:$("gymStart").value,end:$("gymEnd").value},
    library:{start:$("libraryStart").value,end:$("libraryEnd").value},
    studentClass:$("studentClass").value.trim(),
    goal:$("goal").value.trim()
  };
  for(const [name,range] of Object.entries(details)){
    if(range && typeof range==="object" && ((range.start && !range.end)||(!range.start && range.end))){
      throw new Error("Please enter both start and end times for " + name + ".");
    }
    if(range && typeof range==="object" && range.start && range.end && range.end <= range.start){
      throw new Error(name + " end time must be later than its start time.");
    }
  }
  return details;
}

function safeText(value){
  return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function renderSchedule(data){
  const root=$("schedule");
  root.replaceChildren();
  if(!data || !Array.isArray(data.days) || !data.days.length) throw new Error("The AI returned an incomplete timetable. Please try again.");
  $("summary").textContent=data.summary || "A balanced timetable prepared around your routine.";
  data.days.forEach(day=>{
    const section=document.createElement("section");
    section.className="day";
    const heading=document.createElement("h3");
    heading.textContent=day.day || "Daily plan";
    section.appendChild(heading);
    if(!Array.isArray(day.items)) return;
    day.items.forEach(item=>{
      const row=document.createElement("div");
      row.className="slot";
      const time=document.createElement("div");
      time.className="slot-time";
      time.textContent=(item.start||"Flexible")+" – "+(item.end||"");
      const content=document.createElement("div");
      const name=document.createElement("div");
      name.className="slot-name";
      name.textContent=item.activity || "Study session";
      const note=document.createElement("div");
      note.className="slot-note";
      note.textContent=item.notes || "";
      content.append(name,note);
      row.append(time,content);
      section.appendChild(row);
    });
    root.appendChild(section);
  });
  if(!root.children.length) throw new Error("No timetable days were returned. Please regenerate.");
  $("result").hidden=false;
  $("result").scrollIntoView({behavior:"smooth",block:"start"});
}

async function generate(){
  const button=$("generate");
  const status=$("status");
  button.disabled=true;
  status.textContent="NavAI is designing your timetable…";
  $("result").hidden=true;
  try{
    const details=collectDetails();
    lastDetails=details;
    const response=await fetch("/api/timetable/generate",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(details)
    });
    const data=await response.json();
    if(!response.ok) throw new Error(data.error || "Could not generate the timetable.");
    renderSchedule(data);
    status.textContent="Your timetable is ready.";
  }catch(error){
    status.textContent=error.message || "Something went wrong. Please try again.";
  }finally{
    button.disabled=false;
  }
}

$("generate").addEventListener("click",generate);
$("regenerate").addEventListener("click",generate);
$("print").addEventListener("click",()=>window.print());
$("edit").addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));

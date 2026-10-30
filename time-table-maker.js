(() => {
"use strict";

const $ = id => document.getElementById(id);
const val = id => $(id)?.value?.trim() || "";

const esc = s => String(s).replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

function readTime(id) {
  const v = val(id);
  if (!v) return null;
  if (!/^\d{2}:\d{2}$/.test(v)) throw new Error("Invalid time: " + id);
  const [h,m] = v.split(":").map(Number);
  if (h > 23 || m > 59) throw new Error("Invalid time: " + id);
  return h * 60 + m;
}

function clock(n) {
  n = ((n % 1440) + 1440) % 1440;
  const h = Math.floor(n / 60), m = n % 60;
  return `${(h % 12) || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
}

function dur(n) {
  const h = Math.floor(n/60), m = n%60;
  return `${h ? h+"h " : ""}${m ? m+"m" : ""}`.trim() || "0m";
}

function addOptions() {
  if ($("dailyStudyTarget")) return;

  const button = $("generate");
  if (!button?.parentElement) return;

  const panel = document.createElement("section");
  panel.id = "smartRoutineOptions";
  panel.innerHTML = `
    <h3>Personal Routine Settings</h3>

    <div class="tt-travel-grid">
      <label>Wake-up time
        <input id="wakeTime" type="time" value="05:30" required>
      </label>
      <label>Sleep time
        <input id="sleepTime" type="time" value="21:30" required>
      </label>
    </div>

    <label>Daily study target (hours)
      <input id="dailyStudyTarget" type="number" min="1" max="10" step="0.5" value="5">
    </label>

    <p class="tt-help">Library study hours are included in your daily target.</p>

    <h4>One-way travel time (minutes)</h4>
    <div class="tt-travel-grid">
      <label>School
        <input id="travelSchool" type="number" min="0" max="180" value="0">
      </label>
      <label>Coaching
        <input id="travelCoaching" type="number" min="0" max="180" value="0">
      </label>
      <label>Gym
        <input id="travelGym" type="number" min="0" max="180" value="0">
      </label>
      <label>Library
        <input id="travelLibrary" type="number" min="0" max="180" value="0">
      </label>
    </div>

    <p class="tt-help">Travel is included in the related activity timing, not shown separately.</p>
    <p class="tt-help">Meals, breaks and study sessions are arranged using your available time.</p>
  `;

  button.parentElement.insertBefore(panel,button);
}

function collect() {
  const wake = readTime("wakeTime");
  const sleep = readTime("sleepTime");

  if (wake === null || sleep === null)
    throw new Error("Wake-up aur Sleep dono timings select karo.");

  const wakeAbs = wake;
  const sleepAbs = sleep <= wake ? sleep + 1440 : sleep;

  if (sleepAbs - wakeAbs < 600)
    throw new Error("Wake-up aur sleep ke beech kam se kam 10 hours ka daily window rakho.");

  if (sleepAbs - wakeAbs > 1440)
    throw new Error("Sleep timing valid nahi hai.");

  const targetHours = Number(val("dailyStudyTarget") || 5);
  if (!Number.isFinite(targetHours) || targetHours < 1 || targetHours > 10)
    throw new Error("Daily study target 1 se 10 hours ke beech rakho.");

  const specs = [
    ["School","schoolStart","schoolEnd","travelSchool"],
    ["Coaching","coachingStart","coachingEnd","travelCoaching"],
    ["Gym","gymStart","gymEnd","travelGym"],
    ["Library","libraryStart","libraryEnd","travelLibrary"]
  ];

  const commitments = [];

  for (const [name,startId,endId,travelId] of specs) {
    const a = readTime(startId);
    const b = readTime(endId);

    if ((a === null) !== (b === null))
      throw new Error(name + ": start aur end dono timings bharo.");

    if (a === null) continue;

    let start = a;
    while (start < wakeAbs) start += 1440;

    let end = b;
    while (end <= start) end += 1440;

    const travel = Number(val(travelId) || 0);

    if (!Number.isFinite(travel) || travel < 0 || travel > 180)
      throw new Error(name + ": travel time 0–180 minutes rakho.");

    const blockStart = start - travel;
    const blockEnd = end + travel;

    if (blockStart < wakeAbs || blockEnd > sleepAbs)
      throw new Error(name + " aur uska travel tumhare wake-up/sleep window ke bahar ja raha hai.");

    commitments.push({
      name,
      start:blockStart,
      end:blockEnd,
      actualStart:start,
      actualEnd:end,
      kind:"commitment"
    });
  }

  commitments.sort((a,b)=>a.start-b.start);

  for (let i=1;i<commitments.length;i++) {
    if (commitments[i].start < commitments[i-1].end)
      throw new Error(commitments[i-1].name + " aur " + commitments[i].name + " ya unke travel timings overlap kar rahe hain.");
  }

  return {
    wake:wakeAbs,
    sleep:sleepAbs,
    window:sleepAbs-wakeAbs,
    target:Math.round(targetHours*60),
    commitments,
    studentClass:val("studentClass") || "Student",
    goal:val("goal") || "Academic excellence"
  };
}

function getGaps(events,start,end) {
  const sorted = events
    .filter(e=>e.end>start && e.start<end)
    .map(e=>({start:Math.max(start,e.start),end:Math.min(end,e.end)}))
    .sort((a,b)=>a.start-b.start);

  const gaps=[];
  let cursor=start;

  for (const e of sorted) {
    if (e.start>cursor) gaps.push({start:cursor,end:e.start});
    cursor=Math.max(cursor,e.end);
  }

  if (cursor<end) gaps.push({start:cursor,end});

  return gaps;
}

function placeFlexible(events,name,length,ideal,kind,start,end,minLength=length,windowStart=start,windowEnd=end) {
  const candidates = getGaps(events,start,end)
    .map(g => ({
      start: Math.max(g.start,windowStart),
      end: Math.min(g.end,windowEnd)
    }))
    .filter(g => g.end-g.start >= minLength)
    .map(g => {
      const position = Math.max(g.start,Math.min(g.end-length,ideal));
      return {start:position,score:Math.abs(position-ideal)};
    })
    .sort((a,b)=>a.score-b.score);

  if (!candidates.length) return false;

  const s=candidates[0].start;
  events.push({name,start:s,end:s+length,kind});
  return true;
}

function buildPlan(data) {
  const events=[];

  // Wake-up and morning preparation use the student's selected wake time.
  events.push({
    name:"Wake up",
    start:data.wake,
    end:data.wake+15,
    kind:"routine"
  });

  events.push({
    name:"Morning routine",
    start:data.wake+15,
    end:data.wake+45,
    kind:"routine"
  });

  // Commitments include travel internally. Travel is not displayed separately.
  for (const c of data.commitments) {
    events.push({...c});
  }

  // Meals are optional and restricted to suitable parts of the student's day.
  // No fixed clock times are used.
  const mealSettings=[
    {
      name:"Breakfast",length:30,ratio:0.16,kind:"meal",
      from:data.wake+45,to:data.wake+data.window*0.32
    },
    {
      name:"Evening snack",length:20,ratio:0.66,kind:"meal",
      from:data.wake+data.window*0.52,to:data.wake+data.window*0.78
    },
    {
      name:"Dinner",length:35,ratio:0.84,kind:"meal",
      from:data.wake+data.window*0.72,to:data.sleep-15
    }
  ];

  for (const meal of mealSettings) {
    const ideal=data.wake+data.window*meal.ratio;
    placeFlexible(
      events,meal.name,meal.length,ideal,meal.kind,
      data.wake,data.sleep,meal.length,
      meal.from,meal.to
    );
  }

  // Rest is optional too.
  placeFlexible(
    events,
    "Rest / relaxation",
    30,
    data.wake+data.window*0.68,
    "rest",
    data.wake,
    data.sleep
  );

  // Calculate library hours from the actual library session only.
  const libraryMinutes=data.commitments
    .filter(c=>c.name==="Library")
    .reduce((sum,c)=>sum+c.actualEnd-c.actualStart,0);

  // Library time is included in the target.
  let remaining=Math.max(0,data.target-libraryMinutes);
  let selfMinutes=0;

  // Fill free gaps with study blocks. No block is allowed to overlap anything.
  const studyGaps=getGaps(events,data.wake,data.sleep);

  for (const gap of studyGaps) {
    let cursor=gap.start;
    let available=gap.end-gap.start;

    while (available>=25 && remaining>0) {
      const block=Math.min(90,remaining,available);

      if (block<25) break;

      events.push({
        name:"Focused study",
        start:cursor,
        end:cursor+block,
        kind:"study"
      });

      cursor+=block;
      available-=block;
      remaining-=block;
      selfMinutes+=block;

      // Add a break only if study is continuing and enough room remains.
      if (available>=10 && remaining>0) {
        events.push({
          name:"Short break",
          start:cursor,
          end:cursor+10,
          kind:"break"
        });
        cursor+=10;
        available-=10;
      }
    }
  }

  // Any unused time is explicitly shown as personal/free time.
  const freeGaps=getGaps(events,data.wake,data.sleep);
  for (const gap of freeGaps) {
    if (gap.end-gap.start>=10) {
      events.push({
        name:"Personal time / free time",
        start:gap.start,
        end:gap.end,
        kind:"free"
      });
    }
  }

  // Sleep is displayed across midnight if required.
  events.push({
    name:"Sleep",
    start:data.sleep,
    end:data.wake+1440,
    kind:"sleep"
  });

  // Final collision validation.
  const sorted=[...events].sort((a,b)=>a.start-b.start);

  for (let i=1;i<sorted.length;i++) {
    if (sorted[i].start < sorted[i-1].end) {
      throw new Error("Internal timetable overlap: "+sorted[i-1].name+" / "+sorted[i].name);
    }
  }

  const total=libraryMinutes+selfMinutes;

  return {
    events:sorted,
    target:data.target,
    total,
    selfMinutes,
    libraryMinutes,
    remaining:Math.max(0,data.target-total),
    achieved:total>=data.target,
    wake:data.wake,
    sleep:data.sleep,
    studentClass:data.studentClass,
    goal:data.goal
  };
}

function render(p) {
  const result=$("result");
  const schedule=$("schedule");

  if (!result || !schedule)
    throw new Error("Timetable display elements nahi mile. HTML element IDs check karo.");

  if ($("summary")) {
    $("summary").innerHTML=`
      <div class="tt-stats">
        <div class="tt-stat"><strong>${dur(p.target)}</strong><span>Daily study target</span></div>
        <div class="tt-stat"><strong>${dur(p.total)}</strong><span>Total study hours</span></div>
        <div class="tt-stat"><strong>${dur(p.selfMinutes)}</strong><span>Self-study</span></div>
        <div class="tt-stat"><strong>${dur(p.libraryMinutes)}</strong><span>Library study</span></div>
      </div>
      <p><b>Goal:</b> ${esc(p.goal)}</p>
      <p class="tt-status ${p.achieved?"tt-ok":"tt-warn"}">
        ${p.achieved
          ? "Your daily study target is covered."
          : `Your target has ${dur(p.remaining)} remaining. Available free time is not enough to fit the full target.`}
      </p>
      <p class="tt-help">Same routine every day · No subject allocation · Travel merged into activity timings</p>
    `;
  }

  const display=p.events.map(e=>{
    if (e.kind==="commitment") {
      return {...e,displayStart:e.start,displayEnd:e.end};
    }
    return {...e,displayStart:e.start,displayEnd:e.end};
  });

  schedule.innerHTML=`
    <div class="tt-heading">
      <h2>My Permanent Daily Routine</h2>
      <p>${esc(p.studentClass)} · Repeats every day</p>
    </div>
    <div class="tt-list">
      ${display.map(e=>`
        <div class="tt-item tt-${e.kind}">
          <div class="tt-time">${clock(e.displayStart)} – ${clock(e.displayEnd)}</div>
          <div class="tt-activity">
            <strong>${esc(e.name)}</strong>
            <span>${dur(e.end-e.start)}</span>
          </div>
        </div>
      `).join("")}
    </div>
    <p class="tt-help">Wake up: ${clock(p.wake)} · Sleep: ${clock(p.sleep)} · Keep a consistent sleep routine.</p>
  `;

  result.hidden=false;
  result.scrollIntoView({behavior:"smooth",block:"start"});

  if ($("status")) $("status").textContent="Your daily timetable is ready.";
  window.__navaiDailyPlan=p;
}

function generate() {
  try {
    const data=collect();
    const plan=buildPlan(data);
    render(plan);
  } catch(e) {
    if ($("status")) $("status").textContent=e.message;
    else alert(e.message);
  }
}

function printPDF() {
  if (!window.__navaiDailyPlan) {
    alert("Pehle timetable generate karo.");
    return;
  }
  window.print();
}

function bind() {
  addOptions();
  $("generate")?.addEventListener("click",generate);
  $("regenerate")?.addEventListener("click",generate);
  $("print")?.addEventListener("click",printPDF);
  $("edit")?.addEventListener("click",()=>$("smartRoutineOptions")?.scrollIntoView({behavior:"smooth"}));
}

if (document.readyState==="loading") {
  document.addEventListener("DOMContentLoaded",bind,{once:true});
} else {
  bind();
}
})();
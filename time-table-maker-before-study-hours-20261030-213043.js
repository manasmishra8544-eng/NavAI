const $ = id => document.getElementById(id);

function collectDetails() {
  const details = {
    school: {start: $("schoolStart").value, end: $("schoolEnd").value},
    coaching: {start: $("coachingStart").value, end: $("coachingEnd").value},
    gym: {start: $("gymStart").value, end: $("gymEnd").value},
    library: {start: $("libraryStart").value, end: $("libraryEnd").value},
    studentClass: $("studentClass").value.trim(),
    goal: $("goal").value.trim()
  };

  for (const [name, range] of Object.entries(details)) {
    if (range && typeof range === "object") {
      if ((range.start && !range.end) || (!range.start && range.end))
        throw new Error("Enter both start and end times for " + name + ".");
      if (range.start && range.end && range.end <= range.start)
        throw new Error(name + " end time must be later than its start time.");
    }
  }
  return details;
}

function clock(value) {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${String(h % 12 || 12).padStart(2,"0")}:${String(m).padStart(2,"0")} ${suffix}`;
}

function buildRoutine(details) {
  const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const subjects = [
    ["Mathematics","Science","English"],
    ["Science","Social Studies","Hindi"],
    ["Mathematics","English","Computer"],
    ["Science","Mathematics","Social Studies"],
    ["English","Hindi","Science"],
    ["Mathematics","Weekly revision","Doubt solving"],
    ["Weekly revision","Reading","Prepare for next week"]
  ];

  const school = details.school.start && details.school.end
    ? `${clock(details.school.start)} – ${clock(details.school.end)}`
    : "School / classes as per your schedule";

  const fixed = ["coaching","gym","library"].filter(k =>
    details[k].start && details[k].end
  );

  const make = (start,end,activity,notes="") => ({
    start, end, activity, notes
  });

  const result = days.map((day,index) => {
    let items;

    if (index === 6) {
      items = [
        make("07:00 AM","07:30 AM","Wake up and freshen up"),
        make("07:30 AM","08:00 AM","Breakfast"),
        make("08:00 AM","09:00 AM","Weekly revision","Revise important topics from the week."),
        make("09:00 AM","09:30 AM","Break"),
        make("09:30 AM","10:30 AM","Mathematics practice"),
        make("10:30 AM","11:30 AM","Reading and hobbies"),
        make("11:30 AM","01:00 PM","Free time"),
        make("01:00 PM","02:00 PM","Lunch and rest"),
        make("02:00 PM","03:00 PM","Prepare for next week","Arrange books and check pending work."),
        make("03:00 PM","05:00 PM","Outdoor activity and personal time"),
        make("05:00 PM","06:00 PM","Light revision"),
        make("06:00 PM","08:00 PM","Family time and dinner"),
        make("08:00 PM","09:00 PM","Relax and prepare for Monday"),
        make("09:00 PM","09:30 PM","Get ready for bed")
      ];
    } else {
      items = [
        make("05:45 AM","06:00 AM","Wake up"),
        make("06:00 AM","06:25 AM","Freshen up and get ready"),
        make("06:25 AM","06:45 AM","Breakfast"),
        make("06:45 AM","07:00 AM","Get ready for school"),
        make(clock(details.school.start || "07:00"),clock(details.school.end || "14:00"),"School","Attend classes and note homework."),
        make("02:00 PM","02:45 PM","Lunch and rest"),
        make("02:45 PM","03:30 PM","Relax and recharge"),
        make("03:30 PM","04:15 PM","Homework","Complete school assignments."),
        make("04:15 PM","04:30 PM","Short break"),
        make("04:30 PM","05:15 PM",subjects[index][0],"Focused study and practice."),
        make("05:15 PM","05:45 PM","Refreshment and free time"),
        make("05:45 PM","06:30 PM",subjects[index][1],"Understand concepts and make notes."),
        make("06:30 PM","07:00 PM","Break / walk"),
        make("07:00 PM","07:45 PM",subjects[index][2],"Reading, practice or revision."),
        make("07:45 PM","08:15 PM","Dinner"),
        make("08:15 PM","08:45 PM","Daily revision","Review today's schoolwork."),
        make("08:45 PM","09:15 PM","Pack school bag and relax"),
        make("09:15 PM","09:30 PM","Get ready for bed")
      ];
    }

    // Display the user's entered coaching, gym and library timings
    // as fixed commitments. Review the routine if they overlap a suggested slot.
    fixed.forEach(key => {
      items.push(make(
        clock(details[key].start),
        clock(details[key].end),
        key.charAt(0).toUpperCase() + key.slice(1),
        "Your fixed commitment. Keep this timing unchanged."
      ));
    });

    return {day,items};
  });

  return {
    summary: "A clock-based weekly routine for " +
      (details.studentClass || "student") + ". Goal: " +
      (details.goal || "Balanced study and revision") +
      ". Suggested routine: adjust any study slot around your entered commitments.",
    days: result
  };
}

function renderSchedule(data) {
  const root = $("schedule");
  root.replaceChildren();
  $("summary").textContent = data.summary;

  data.days.forEach(day => {
    const section = document.createElement("section");
    section.className = "day";
    const heading = document.createElement("h3");
    heading.textContent = day.day;
    section.appendChild(heading);

    day.items.forEach(item => {
      const row = document.createElement("div");
      row.className = "slot";
      const time = document.createElement("div");
      time.className = "slot-time";
      time.textContent = item.start + " – " + item.end;

      const content = document.createElement("div");
      const name = document.createElement("div");
      name.className = "slot-name";
      name.textContent = item.activity;
      const note = document.createElement("div");
      note.className = "slot-note";
      note.textContent = item.notes || "";
      content.append(name,note);
      row.append(time,content);
      section.appendChild(row);
    });

    root.appendChild(section);
  });

  $("result").hidden = false;
  $("result").scrollIntoView({behavior:"smooth",block:"start"});
}

function generate() {
  const button = $("generate");
  button.disabled = true;
  try {
    const details = collectDetails();
    const timetable = buildRoutine(details);
    renderSchedule(timetable);
    $("status").textContent = "Your routine-based weekly timetable is ready!";
  } catch (error) {
    $("status").textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

$("generate").addEventListener("click",generate);
$("regenerate").addEventListener("click",generate);
$("print").addEventListener("click",()=>window.print());
$("edit").addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));

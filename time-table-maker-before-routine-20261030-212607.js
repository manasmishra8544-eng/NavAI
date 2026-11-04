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
      if ((range.start && !range.end) || (!range.start && range.end)) {
        throw new Error("Please enter both start and end times for " + name + ".");
      }
      if (range.start && range.end && range.end <= range.start) {
        throw new Error(name + " end time must be later than its start time.");
      }
    }
  }
  return details;
}

function makeFallback(details) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const subjects = [
    ["Mathematics", "Science", "English", "Social Studies"],
    ["Science", "Mathematics", "Hindi", "Computer"],
    ["English", "Social Studies", "Mathematics", "Science"],
    ["Mathematics", "Hindi", "Science", "English"],
    ["Social Studies", "Science", "Mathematics", "Computer"],
    ["Mathematics", "English", "Weekly revision", "Doubt solving"],
    ["Weekly revision", "Reading", "Prepare for next week", "Rest and hobbies"]
  ];

  const fixed = Object.entries(details)
    .filter(([key, value]) => ["school", "coaching", "gym", "library"].includes(key) && value.start && value.end)
    .map(([key, value]) => ({
      start: value.start,
      end: value.end,
      activity: key.charAt(0).toUpperCase() + key.slice(1),
      notes: "Your fixed commitment."
    }));

  return {
    summary: "Your balanced weekly plan for " +
      (details.studentClass || "student") + ". Goal: " +
      (details.goal || "Balanced study and revision") +
      ". Study sessions are flexible. Keep your fixed commitments unchanged.",
    days: days.map((day, index) => ({
      day,
      items: [
        ...subjects[index].map((subject, i) => ({
          start: "Flexible",
          end: "",
          activity: subject,
          notes: i === 0
            ? "Focus session. Adjust around your daily routine."
            : "Practice, homework or revision. Take breaks between sessions."
        })),
        {
          start: "Flexible",
          end: "",
          activity: "Break and personal time",
          notes: "Relax, eat properly and get enough rest."
        },
        ...fixed
      ]
    }))
  };
}

function renderSchedule(data) {
  const root = $("schedule");
  root.replaceChildren();

  if (!data || !Array.isArray(data.days) || !data.days.length) {
    throw new Error("No timetable days available.");
  }

  $("summary").textContent = data.summary || "Your weekly timetable is ready.";

  data.days.forEach(day => {
    const section = document.createElement("section");
    section.className = "day";

    const heading = document.createElement("h3");
    heading.textContent = day.day || "Daily plan";
    section.appendChild(heading);

    (Array.isArray(day.items) ? day.items : []).forEach(item => {
      const row = document.createElement("div");
      row.className = "slot";

      const time = document.createElement("div");
      time.className = "slot-time";
      time.textContent = (item.start || "Flexible") +
        (item.end ? " – " + item.end : "");

      const content = document.createElement("div");
      const name = document.createElement("div");
      name.className = "slot-name";
      name.textContent = item.activity || "Study session";

      const note = document.createElement("div");
      note.className = "slot-note";
      note.textContent = item.notes || "";

      content.append(name, note);
      row.append(time, content);
      section.appendChild(row);
    });

    root.appendChild(section);
  });

  $("result").hidden = false;
  $("result").scrollIntoView({behavior: "smooth", block: "start"});
}

async function generate() {
  const button = $("generate");
  const status = $("status");

  button.disabled = true;
  status.textContent = "NavAI is preparing your weekly timetable...";
  $("result").hidden = true;

  try {
    const details = collectDetails();
    let timetable;
    let usedFallback = false;

    try {
      const response = await fetch("/api/timetable/generate", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(details)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "AI service unavailable");
      }

      if (!data || !Array.isArray(data.days) || data.days.length < 7) {
        throw new Error("Incomplete AI timetable");
      }

      timetable = data;
    } catch (aiError) {
      console.warn("Using local timetable fallback:", aiError);
      timetable = makeFallback(details);
      usedFallback = true;
    }

    renderSchedule(timetable);

    status.textContent = usedFallback
      ? "Your weekly timetable is ready! Backup planner was used because AI is temporarily unavailable."
      : "Your AI timetable is ready!";
  } catch (error) {
    status.textContent = error.message || "Please check your details and try again.";
  } finally {
    button.disabled = false;
  }
}

$("generate").addEventListener("click", generate);
$("regenerate").addEventListener("click", generate);
$("print").addEventListener("click", () => window.print());
$("edit").addEventListener("click", () => window.scrollTo({top: 0, behavior: "smooth"}));

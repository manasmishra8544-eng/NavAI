const canvas = document.getElementById("paper");
const ctx = canvas.getContext("2d");
const topic = document.getElementById("topic");
const statusBox = document.getElementById("status");
const generate = document.getElementById("generate");
const download = document.getElementById("download");

function wrapText(text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split(/\n/)) {
    if (!paragraph.trim()) { lines.push(""); continue; }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? line + " " + word : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawPage(title, body, style) {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = "#fffef8";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#dce8f5";
  ctx.lineWidth = 1;
  for (let y = 80; y < H; y += 42) {
    ctx.beginPath(); ctx.moveTo(35, y); ctx.lineTo(W - 30, y); ctx.stroke();
  }
  ctx.strokeStyle = "#f0a3a3";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(105, 35); ctx.lineTo(105, H - 30); ctx.stroke();

  const ink = style === "colour" ? "#3448b8" : "#214d91";
  let y = 92;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = style === "colour" ? "#7545c8" : ink;
  ctx.font = "bold 36px 'Segoe Print','Comic Sans MS',cursive";
  ctx.fillText(title.slice(0, 42), 135, y);
  y += 52;

  ctx.fillStyle = "#a33b3b";
  ctx.fillRect(135, y - 8, Math.min(ctx.measureText(title).width, 650), 3);
  y += 38;

  ctx.fillStyle = ink;
  ctx.font = "25px 'Segoe Print','Comic Sans MS',cursive";
  const paragraphs = body.split("\n");
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) { y += 18; continue; }
    const isHeading = /^(#{1,3}\s|KEY POINTS|SUMMARY|DEFINITION|EXAMPLE|IMPORTANT)/i.test(paragraph);
    let text = paragraph.replace(/^#{1,3}\s*/, "");
    if (isHeading) {
      y += 10;
      ctx.font = "bold 27px 'Segoe Print','Comic Sans MS',cursive";
      ctx.fillStyle = style === "colour" ? "#b04461" : "#173e7c";
    } else {
      ctx.font = "24px 'Segoe Print','Comic Sans MS',cursive";
      ctx.fillStyle = ink;
    }
    const lines = wrapText(text, W - 190);
    for (const line of lines) {
      if (y > H - 65) break;
      ctx.fillText(line, 135, y);
      y += 37;
    }
  }
  ctx.fillStyle = "#7a879b";
  ctx.font = "16px Arial,sans-serif";
  ctx.fillText("NavAI • Study Notes", 135, H - 28);
}

function fallbackNotes(name, grade, kind) {
  const detail = kind === "quick"
    ? "Write the main idea of this topic in your own words.\n\n## KEY POINTS\n• Learn the important terms.\n• Understand the process or concept step by step.\n• Revise examples from your textbook.\n\n## SUMMARY\nReview the definition, key facts and one example."
    : kind === "definitions"
    ? "## DEFINITION\nWrite the textbook definition of " + name + ".\n\n## KEY POINTS\n• Identify the main terms and their meanings.\n• Note the important facts.\n• Add a labelled diagram if the topic needs one.\n\n## EXAMPLE\nUse an example from your Class " + grade + " textbook."
    : "## INTRODUCTION\n" + name + " is a topic to understand using its definition, main ideas and examples.\n\n## KEY POINTS\n• Learn the core definition from your textbook.\n• Break the concept into smaller steps.\n• Note important terms, facts and relationships.\n\n## EXAMPLE\nAdd a relevant textbook example and explain why it fits.\n\n## SUMMARY\nRevise the definition, key points and example.";
  return detail;
}

async function generateNotes() {
  const name = topic.value.trim();
  if (!name) { statusBox.textContent = "Please enter a topic first."; return; }

  generate.disabled = true;
  download.disabled = true;
  statusBox.textContent = "Preparing your notes...";

  const grade = document.getElementById("grade").value;
  const kind = document.getElementById("kind").value;
  let body = fallbackNotes(name, grade, kind);
  let usedAI = false;

  try {
    const prompt = "Create accurate school study notes for Class " + grade +
      " on: " + name + ". Type: " + kind +
      ". Use plain text, short clear sentences and headings beginning with ##. " +
      "Use bullet points with •. No Markdown tables. Keep it suitable for a student. " +
      "If unsure about a fact, do not invent it.";
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({message: prompt})
    });
    if (response.ok) {
      const data = await response.json();
      const answer = data.reply || data.response || data.answer ||
        data.message || data.content ||
        (data.choices && data.choices[0] &&
          data.choices[0].message && data.choices[0].message.content);
      if (typeof answer === "string" && answer.trim()) {
        body = answer.trim();
        usedAI = true;
      }
    }
  } catch (_) {
    // Local fallback keeps the notes image feature usable without the API.
  }

  drawPage(name + " — Class " + grade, body,
    document.getElementById("style").value);
  download.disabled = false;
  statusBox.textContent = usedAI
    ? "Notes generated. Check the content, then download your PNG."
    : "Notebook image ready. AI text was unavailable, so review and complete the template.";
  generate.disabled = false;
}

generate.addEventListener("click", generateNotes);
download.addEventListener("click", () => {
  const a = document.createElement("a");
  a.download = "NavAI-Notes-" +
    topic.value.trim().replace(/[^a-z0-9]+/gi, "-").slice(0, 50) + ".png";
  a.href = canvas.toDataURL("image/png");
  a.click();
});

drawPage("Your Study Notes", "Enter a topic and select Generate Notes Image.\n\nYour notebook-style page will appear here.", "blue");

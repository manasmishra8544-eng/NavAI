(() => {
  "use strict";
  const board = document.getElementById("board");
  if (!board || window.__NAVAI_DUAL_DIAGRAMS__) return;
  window.__NAVAI_DUAL_DIAGRAMS__ = true;

  let lastKey = "";
  let imageKey = "";

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);

  const label = (x,y,s,size=15,color="#eaf2ff") =>
    `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="middle" font-family="Arial,sans-serif">${esc(s)}</text>`;

  const box = (x,y,w,h,s,color="#183b50") =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${color}" stroke="#6ddbc9"/>${label(x+w/2,y+h/2+5,s)}`;

  function svg(title, content) {
    return `<svg class="nd-svg" viewBox="0 0 680 300" role="img" aria-label="${esc(title)}">
      <defs><linearGradient id="ndbg" x2="1" y2="1">
      <stop stop-color="#132b49"/><stop offset="1" stop-color="#0b1728"/></linearGradient>
      <marker id="ndarrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0 0 L6 3 L0 6Z" fill="#82ead6"/></marker></defs>
      <rect width="680" height="300" rx="16" fill="url(#ndbg)"/>${content}</svg>`;
  }

  function choose(topic, details) {
    const t = (topic + " " + details).toLowerCase();

    if (/photosynthesis|प्रकाश संश्लेषण/.test(t)) {
      return {
        type:"Built-in science diagram", title:"Photosynthesis",
        svg:svg("Photosynthesis",
          box(25,110,145,65,"Sunlight","#4b3b24")+
          box(265,110,145,65,"Leaf","#17453d")+
          box(510,35,145,60,"Carbon dioxide")+
          box(510,120,145,60,"Water")+
          box(265,220,145,50,"Glucose","#44345f")+
          box(25,220,145,50,"Oxygen","#17453d")+
          `<path d="M170 142H257 M510 65L420 120 M510 150H418 M337 175V212 M265 245H178"
          stroke="#82ead6" stroke-width="3" fill="none" marker-end="url(#ndarrow)"/>`+
          label(340,25,"Plants use light to make food",18,"#91f4df"))
      };
    }

    if (/graph|coordinate|linear equation|polynomial|parabola|distance.?time|velocity.?time/.test(t)) {
      const grid = Array.from({length:13},(_,i)=>
        `<line x1="${70+i*45}" y1="35" x2="${70+i*45}" y2="260"/>`).join("")+
        Array.from({length:7},(_,i)=>
        `<line x1="70" y1="${35+i*37.5}" x2="610" y2="${35+i*37.5}"/>`).join("");
      return {
        type:"Built-in graph", title:"Coordinate graph",
        svg:svg("Coordinate graph",
          `<g stroke="#27435c">${grid}</g>
          <path d="M70 260V30 M70 260H625" stroke="#e2ebff" stroke-width="2" fill="none" marker-end="url(#ndarrow)"/>
          <path d="M100 235L190 198L280 161L370 124L460 87L550 50" fill="none" stroke="#75ead4" stroke-width="4"/>`+
          label(340,22,"Illustrative straight-line graph",17,"#91f4df")+
          label(640,280,"x")+label(45,35,"y"))
      };
    }

    if (/flowchart|algorithm|water cycle|evaporation|condensation|precipitation|life cycle/.test(t)) {
      const water = /water cycle|evaporation|condensation|precipitation/.test(t);
      const names = water
        ? ["Evaporation","Condensation","Precipitation","Collection"]
        : ["Start","Input","Process","Result"];
      return {
        type:"Built-in flowchart", title:"Process flow",
        svg:svg("Process flow",
          box(15,105,150,70,names[0])+box(185,105,150,70,names[1])+
          box(355,105,150,70,names[2])+box(525,105,140,70,names[3])+
          `<path d="M165 140H178 M335 140H348 M505 140H518" stroke="#82ead6" stroke-width="3" marker-end="url(#ndarrow)"/>`+
          label(340,55,"Follow each stage in order",18,"#91f4df"))
      };
    }

    if (/atom|molecule|cell|solar system|planet|heart|human body|volcano|ecosystem|digestion|earth layers|plant cell|animal cell/.test(t)) {
      return {
        type:"AI illustration", title:"Visual illustration",
        prompt:`Create an accurate educational illustration about ${topic}. Level: ${document.getElementById("level")?.value || "Beginner"}. Dark navy and blue classroom infographic, clear central subject, simple readable English labels, scientifically accurate, uncluttered, no watermark.`
      };
    }

    return {
      type:"Built-in concept map", title:"Topic overview",
      svg:svg("Concept map",
        box(230,105,220,75,topic.slice(0,32),"#1a3554")+
        box(20,35,160,60,"Main idea","#173f3b")+
        box(500,35,160,60,"Example","#44345f")+
        box(20,205,160,60,"Key details","#4b3b24")+
        box(500,205,160,60,"Remember","#173f3b")+
        `<path d="M180 65L245 112 M500 65L435 112 M180 235L245 170 M500 235L435 170"
        stroke="#82ead6" stroke-width="2.5" fill="none" marker-end="url(#ndarrow)"/>`+
        label(340,280,"Explore the lesson steps for details",13))
    };
  }

  async function render(key, topic, details) {
    const v = choose(topic, details);
    let panel = document.getElementById("navaiDiagramPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "navaiDiagramPanel";
      panel.className = "navai-diagram-panel";
      board.appendChild(panel);
    }

    panel.innerHTML = `
      <div class="nd-heading">
        <div><span class="nd-kicker">VISUAL LEARNING</span><h4>${esc(v.title)}</h4></div>
        <span class="nd-badge">${esc(v.type)}</span>
      </div>
      <div class="nd-art">${v.svg || '<div class="nd-loading">Generating an AI illustration…</div>'}</div>
      <p class="nd-caption">${v.prompt ? "Preparing a topic-specific illustration." : "Automatically selected for your lesson."}</p>`;

    if (!v.prompt || imageKey === key) return;
    imageKey = key;

    try {
      const r = await fetch("/api/generate-image", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({prompt:v.prompt})
      });
      const data = await r.json();
      const src = data.image || data.image_url || data.url;
      if (!r.ok || !src) throw new Error("Image unavailable");
      if (lastKey !== key) return;

      const img = document.createElement("img");
      img.className = "nd-ai-image";
      img.alt = "Educational illustration: " + topic;
      img.loading = "lazy";
      img.src = src;
      panel.querySelector(".nd-art").replaceChildren(img);
      panel.querySelector(".nd-caption").textContent = "AI-generated educational illustration.";
    } catch {
      if (lastKey !== key) return;
      panel.querySelector(".nd-art").innerHTML = v.svg ||
        svg("Concept map",
          box(30,105,180,70,"Main concept")+box(250,105,180,70,"Explanation")+
          box(470,105,180,70,"Example")+
          `<path d="M210 140H243 M430 140H463" stroke="#82ead6" stroke-width="3" marker-end="url(#ndarrow)"/>`);
      panel.querySelector(".nd-caption").textContent =
        "AI illustration unavailable; showing a built-in diagram instead.";
    }
  }

  function inspect() {
    const heading = board.querySelector(".lesson-heading h3");
    if (!heading || !board.querySelector(".lesson-grid")) return;
    const topic = heading.textContent.trim() || "Lesson";
    const intro = board.querySelector(".lesson-heading p")?.textContent || "";
    const steps = Array.from(board.querySelectorAll(".lesson-step"))
      .map(e => e.innerText || e.textContent || "").join(" ");
    const key = (topic+"|"+intro+"|"+steps).slice(0,6000);
    if (key === lastKey) return;
    lastKey = key;
    document.getElementById("navaiDiagramPanel")?.remove();
    render(key, topic, intro+" "+steps);
  }

  new MutationObserver(() => requestAnimationFrame(inspect))
    .observe(board,{childList:true,subtree:true});
  setTimeout(inspect,500);
})();
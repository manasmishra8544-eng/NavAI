(() => {
  const level = document.getElementById("level");
  const boardSection = document.querySelector(".board-section");
  if (!level || !boardSection || document.getElementById("teacherStage")) return;

  const oldMascot = document.querySelector(".welcome .mascot-wrap");
  if (oldMascot) oldMascot.remove();

  const stage = document.createElement("section");
  stage.id = "teacherStage";
  stage.className = "teacher-stage";
  stage.innerHTML = `
    <div class="teacher-visual">
      <div class="avatar avatar-human" id="teacherAvatar" role="img" aria-label="Illustrated AI teacher">
        <div class="avatar-aura"></div>
        <div class="avatar-orbit"></div>
        <div class="avatar-shoulders"></div>
        <div class="avatar-neck"></div>
        <div class="avatar-head">
          <div class="avatar-hair"></div>
          <div class="avatar-ears"><i></i><i></i></div>
          <div class="avatar-eyes"><i></i><i></i></div>
          <div class="avatar-brows"><i></i><i></i></div>
          <div class="avatar-cheeks"><i></i><i></i></div>
          <div class="avatar-mouth"></div>
        </div>
        <div class="avatar-shirt"></div>
        <div class="avatar-jacket"></div>
        <div class="avatar-emblem">N</div>
        <div class="avatar-light"></div>
      </div>
      <span class="avatar-name" id="avatarName">NAVAI · AI TUTOR</span>
      <span class="avatar-caption"><i></i> PERSONAL LEARNING GUIDE</span>
    </div>
    <div class="teacher-message">
      <span class="teacher-kicker"><i></i> YOUR PERSONAL LEARNING PARTNER</span>
      <h3 id="teacherTitle">Meet Your AI Tutor<span class="teacher-title-dot">.</span></h3>
      <p id="teacherDescription">Complex ideas, made clear. Explore any topic with structured explanations, practical examples and a lesson that unfolds step by step.</p>
      <div class="teacher-benefits">
        <span><b>01</b> Clear explanations</span>
        <span><b>02</b> Guided examples</span>
        <span><b>03</b> Learn by listening</span>
      </div>
      <div class="teacher-state" id="teacherState"><i></i><span>Ready for your next question</span></div>
    </div>`;
  boardSection.before(stage);

  function updateTeacher() {
    const value = level.value;
    const match = value.match(/Class\s+(\d+)/i);
    const n = match ? Number(match[1]) : null;
    const title = document.getElementById("teacherTitle");
    const description = document.getElementById("teacherDescription");
    const name = document.getElementById("avatarName");

    title.textContent = "Meet Your AI Tutor";
    description.textContent =
      n !== null
        ? `Personalised explanations for Class ${n}, with clear examples, guided reasoning and step-by-step lessons.`
        : "Explore any topic with clear explanations, practical examples and step-by-step lessons.";
    name.textContent = "NAVAI · AI TUTOR";
  }

  level.addEventListener("change", updateTeacher);
  updateTeacher();

  let lastSpeaking = false;
  window.setInterval(() => {
    const speaking = "speechSynthesis" in window &&
      window.speechSynthesis.speaking &&
      !window.speechSynthesis.paused;

    stage.classList.toggle("teacher-speaking", speaking);

    const state = document.getElementById("teacherState");
    if (state) {
      state.classList.toggle("is-speaking", speaking);
      state.querySelector("span").textContent =
        speaking ? "Explaining your lesson..." : "Ready for your next question";
    }

    if (speaking !== lastSpeaking) {
      stage.classList.toggle("voice-active", speaking);
      lastSpeaking = speaking;
    }
  }, 180);
})();
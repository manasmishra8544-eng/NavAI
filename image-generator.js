(() => {
  if (document.getElementById("navai-imagegen-panel")) return;

  const panel = document.createElement("section");
  panel.id = "navai-imagegen-panel";
  panel.className = "navai-imagegen-panel";
  panel.innerHTML = `
    <div class="navai-imagegen-card">
      <div class="navai-imagegen-heading">
        <div>
          <div class="navai-imagegen-kicker">NAVAI CREATIVE STUDIO</div>
          <h2>Create an image</h2>
          <p>Turn your idea into artwork with AI.</p>
        </div>
        <button type="button" id="navai-imagegen-close" aria-label="Close">✕</button>
      </div>
      <label for="navai-imagegen-prompt">Describe your image</label>
      <textarea id="navai-imagegen-prompt" maxlength="700" rows="4"
        placeholder="A futuristic blue-and-violet city at night, cinematic lighting..."></textarea>
      <div class="navai-imagegen-actions">
        <span id="navai-imagegen-status">Generation may take a little time.</span>
        <button type="button" id="navai-imagegen-generate">Generate image</button>
      </div>
      <div id="navai-imagegen-result" class="navai-imagegen-result" aria-live="polite"></div>
    </div>`;

  document.body.append(panel);

  const prompt = document.getElementById("navai-imagegen-prompt");
  const status = document.getElementById("navai-imagegen-status");
  const generate = document.getElementById("navai-imagegen-generate");
  const result = document.getElementById("navai-imagegen-result");

  function closePanel() {
    panel.classList.remove("is-open");
  }

  document.addEventListener("navai:open-image-generator", () => {
    panel.classList.add("is-open");
    prompt.focus();
  });
  document.getElementById("navai-imagegen-close").addEventListener("click", closePanel);
  panel.addEventListener("click", event => {
    if (event.target === panel) closePanel();
  });

  generate.addEventListener("click", async () => {
    const text = prompt.value.trim();
    if (!text) {
      status.textContent = "Enter an image description first.";
      prompt.focus();
      return;
    }

    generate.disabled = true;
    generate.textContent = "Creating...";
    status.textContent = "Generating your image. Please wait…";
    result.replaceChildren();

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      if (!data.image) throw new Error("The image service returned no image.");

      const image = document.createElement("img");
      image.src = data.image;
      image.alt = text;
      image.className = "navai-imagegen-preview";

      const download = document.createElement("a");
      download.href = data.image;
      download.download = "navai-generated-image.png";
      download.className = "navai-imagegen-download";
      download.textContent = "Download image";

      result.append(image, download);
      status.textContent = "Your image is ready!";
    } catch (error) {
      status.textContent = error.message || "Image generation failed. Try again.";
    } finally {
      generate.disabled = false;
      generate.textContent = "Generate image";
    }
  });
})();

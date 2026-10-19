"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const prompt = $("prompt"), generate = $("generate"), download = $("download");
  const preview = $("preview"), stage = $("stage"), status = $("status");
  let currentHTML = "";

  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle("error", error);
  }

  document.querySelectorAll("[data-prompt]").forEach(button => {
    button.addEventListener("click", () => {
      prompt.value = button.dataset.prompt;
      prompt.focus();
    });
  });

  $("desktop").addEventListener("click", () => stage.classList.remove("mobile"));
  $("mobile").addEventListener("click", () => stage.classList.add("mobile"));

  download.addEventListener("click", () => {
    if (!currentHTML) return;
    const url = URL.createObjectURL(new Blob([currentHTML], {type:"text/html;charset=utf-8"}));
    const a = document.createElement("a");
    a.href = url;
    a.download = "navai-generated-website.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  generate.addEventListener("click", async () => {
    const instruction = prompt.value.trim();
    if (!instruction) {
      message("Please describe the website you want to create.", true);
      prompt.focus();
      return;
    }
    generate.disabled = true;
    download.disabled = true;
    message("Building your website… this can take a little while.");
    try {
      const response = await fetch("/api/website-builder", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({prompt:instruction, existing_html:currentHTML})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed.");
      if (typeof data.html !== "string" || !data.html.toLowerCase().includes("<html")) {
        throw new Error("The AI response did not contain a complete HTML document. Try again.");
      }
      currentHTML = data.html;
      preview.srcdoc = currentHTML;
      download.disabled = false;
      message("Website generated successfully! Edit the prompt to request changes.");
    } catch (error) {
      message(error.message || "Something went wrong. Please try again.", true);
    } finally {
      generate.disabled = false;
    }
  });
})();


"use strict";

(() => {
  const $ = id => document.getElementById(id);

  const prompt = $("prompt");
  const generate = $("generate");
  const download = $("download");
  const preview = $("preview");
  const stage = $("stage");
  const status = $("status");
  const layout = $("layout");
  const previewPanel = $("preview-panel");
  const loadingScreen = $("loading-screen");
  const loadingTitle = $("loading-title");
  const loadingDescription = $("loading-description");
  const loadingIcon = $("loading-icon");
  const previewSubtitle = $("preview-subtitle");
  const creditsValue = $("credits-value");
  const desktopButton = $("desktop");
  const mobileButton = $("mobile");
  const openPreviewButton = $("open-preview");

  let currentHTML = "";
  let isGenerating = false;

  function message(text, type = "") {
    status.textContent = text;
    status.classList.toggle("error", type === "error");
    status.classList.toggle("success", type === "success");
  }

  function showPreview() {
    previewPanel.hidden = false;
    layout.classList.remove("preview-closed");
  }

  function showLoading(title, description, icon = "✦") {
    loadingScreen.hidden = false;
    preview.hidden = true;
    loadingTitle.textContent = title;
    loadingDescription.textContent = description;
    loadingIcon.textContent = icon;
    previewSubtitle.textContent = "Building your website…";
  }

  function showGeneratedWebsite() {
    loadingScreen.hidden = true;
    preview.hidden = false;
    previewSubtitle.textContent = "Website generated · Preview is ready";
    openPreviewButton.style.display = "inline-flex";
  }

  // Update credits only when the server actually supplies a balance.
  // Supports several common response field names without inventing a balance.
  function updateCredits(data) {
    if (!data || typeof data !== "object") return;

    const candidates = [
      data.credits_remaining,
      data.remaining_credits,
      data.creditsRemaining,
      data.remainingCredits,
      data.daily_remaining,
      data.dailyRemaining,
      data.quota && data.quota.remaining,
      data.usage && data.usage.remaining,
      data.credits && typeof data.credits === "object"
        ? data.credits.remaining
        : undefined
    ];

    const balance = candidates.find(value =>
      (typeof value === "number" && Number.isFinite(value) && value >= 0) ||
      (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0)
    );

    if (balance !== undefined) {
      creditsValue.textContent = String(balance);
      creditsValue.title = "Remaining credits reported by the NavAI server";
      return;
    }

    const used = [
      data.credits_used,
      data.creditsUsed,
      data.daily_used,
      data.dailyUsed,
      data.usage && data.usage.used
    ].find(value =>
      (typeof value === "number" && Number.isFinite(value) && value >= 0) ||
      (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0)
    );

    if (used !== undefined) {
      creditsValue.textContent = `${used} used`;
      creditsValue.title = "Usage reported by the NavAI server";
    }
  }

  document.querySelectorAll("[data-prompt]").forEach(button => {
    button.addEventListener("click", () => {
      prompt.value = button.dataset.prompt || "";
      prompt.focus();
      prompt.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  function setDevice(device) {
    const mobile = device === "mobile";
    stage.classList.toggle("mobile", mobile);
    mobileButton.classList.toggle("active", mobile);
    desktopButton.classList.toggle("active", !mobile);
  }

  desktopButton.addEventListener("click", () => setDevice("desktop"));
  mobileButton.addEventListener("click", () => setDevice("mobile"));

  download.addEventListener("click", () => {
    if (!currentHTML) return;

    const blob = new Blob([currentHTML], {
      type: "text/html;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "navai-generated-website.html";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  openPreviewButton.addEventListener("click", () => {
    if (!currentHTML) return;

    const blob = new Blob([currentHTML], {
      type: "text/html;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const tab = window.open(url, "_blank", "noopener");

    if (!tab) {
      URL.revokeObjectURL(url);
      message("Your browser blocked the new tab. Use Download HTML instead.", "error");
      return;
    }

    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });

  async function generateWebsite() {
    if (isGenerating) return;

    const instruction = prompt.value.trim();

    if (!instruction) {
      message("Describe the website you want to create first.", "error");
      prompt.focus();
      return;
    }

    isGenerating = true;
    generate.disabled = true;
    download.disabled = true;

    showPreview();
    showLoading(
      currentHTML ? "Updating your website…" : "Creating your website…",
      currentHTML
        ? "NavAI is applying your changes. Your current preview will return when the update is ready."
        : "Your idea is being turned into a website. This may take a little while.",
      "✦"
    );

    message(
      currentHTML
        ? "Updating your existing website…"
        : "Building your website… this can take a little while."
    );

    // Bring the preview into view after the user starts generation.
    previewPanel.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
      const response = await fetch("/api/website-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: instruction,
          existing_html: currentHTML
        })
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error("The server returned an invalid response. Please try again.");
      }

      updateCredits(data);

      if (!response.ok) {
        throw new Error(data.error || "Website generation failed.");
      }

      if (
        typeof data.html !== "string" ||
        !data.html.toLowerCase().includes("<html")
      ) {
        throw new Error(
          "The AI response did not contain a complete HTML document. Try again."
        );
      }

      currentHTML = data.html;
      preview.srcdoc = currentHTML;

      // Wait until the generated document has loaded before showing it.
      await new Promise(resolve => {
        let completed = false;

        const finish = () => {
          if (completed) return;
          completed = true;
          preview.removeEventListener("load", finish);
          resolve();
        };

        preview.addEventListener("load", finish);
        setTimeout(finish, 1800);
      });

      showGeneratedWebsite();
      download.disabled = false;
      message(
        "Website generated successfully! Describe any changes you want in the prompt.",
        "success"
      );
    } catch (error) {
      showLoading(
        "We couldn't finish that build",
        error.message || "Something went wrong. Please try again.",
        "!"
      );

      message(
        error.message || "Something went wrong. Please try again.",
        "error"
      );
    } finally {
      isGenerating = false;
      generate.disabled = false;
    }
  }

  window.addEventListener("navai:restore-website", event => {
    const saved = event.detail || {};
    if (typeof saved.html !== "string" || !saved.html.toLowerCase().includes("<html")) return;
    currentHTML = saved.html;
    prompt.value = saved.prompt || "";
    preview.srcdoc = currentHTML;
    showPreview();
    showGeneratedWebsite();
    download.disabled = false;
    message("Saved website restored. You can preview, download, or continue editing it.", "success");
  });

  generate.addEventListener("click", generateWebsite);
  $("regenerate").addEventListener("click", generateWebsite);

  prompt.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      generateWebsite();
    }
  });
})();

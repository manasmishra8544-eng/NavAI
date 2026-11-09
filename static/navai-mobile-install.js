(() => {
  "use strict";

  const KEY = "navai_pwa_installed";
  let deferredPrompt = null;

  const isPhone = () => {
    const ua = navigator.userAgent || "";
    const mobileUA = /Android|iPhone|iPod|Mobile/i.test(ua);
    const phoneLayout = window.matchMedia("(max-width: 767px)").matches;
    return mobileUA && phoneLayout;
  };

  const isInstalled = () => {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      navigator.standalone === true ||
      localStorage.getItem(KEY) === "yes";
  };

  function hideButton() {
    const button = document.getElementById("navai-mobile-install");
    if (button) button.remove();
  }

  function createButton() {
    if (!isPhone() || isInstalled()) return;
    if (document.getElementById("navai-mobile-install")) return;

    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    const button = document.createElement("button");
    button.id = "navai-mobile-install";
    button.type = "button";
    button.setAttribute("aria-label", "Install NavAI");

    button.innerHTML = `
      <span class="navai-install-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 3v11m0 0 4-4m-4 4-4-4"
            stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
            stroke="currentColor" stroke-width="2"
            stroke-linecap="round"/>
        </svg>
      </span>
      <span class="navai-install-copy">
        <strong>Install NavAI</strong>
        <small>Add app to your phone</small>
      </span>
      <span class="navai-install-arrow" aria-hidden="true">→</span>
    `;

    button.addEventListener("click", async () => {
      if (isInstalled()) {
        hideButton();
        return;
      }

      if (deferredPrompt) {
        button.disabled = true;

        try {
          deferredPrompt.prompt();
          const result = await deferredPrompt.userChoice;

          if (result && result.outcome === "accepted") {
            localStorage.setItem(KEY, "yes");
            hideButton();
          }
        } catch (error) {
          console.warn("NavAI install prompt:", error);
        } finally {
          deferredPrompt = null;
          if (document.body.contains(button)) button.disabled = false;
        }

        return;
      }

      if (ios) {
        alert(
          "NavAI ko install karne ke liye:\n\n" +
          "1. Safari mein Share button dabayein.\n" +
          "2. Add to Home Screen select karein.\n" +
          "3. Add dabayein.\n\n" +
          "Install hone ke baad NavAI icon Home Screen par milega."
        );
      }
    });

    document.body.appendChild(button);
  }

  function refresh() {
    if (!isPhone() || isInstalled()) {
      hideButton();
      return;
    }

    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    // iOS uses the browser's Add to Home Screen menu.
    if (ios || deferredPrompt) createButton();
    else hideButton();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    refresh();
  });

  window.addEventListener("appinstalled", () => {
    localStorage.setItem(KEY, "yes");
    deferredPrompt = null;
    hideButton();
  });

  window.addEventListener("resize", refresh);
  window.addEventListener("pageshow", refresh);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true });
  } else {
    refresh();
  }
})();

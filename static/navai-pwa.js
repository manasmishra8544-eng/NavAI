(() => {
  "use strict";

  let installPrompt = null;
  const KEY = "navai_pwa_installed";

  const isInstalled = () => {
    return localStorage.getItem(KEY) === "yes" ||
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  };

  function showMessage(message) {
    let box = document.getElementById("navai-pwa-message");

    if (!box) {
      box = document.createElement("div");
      box.id = "navai-pwa-message";
      document.body.appendChild(box);
    }

    box.textContent = message;
    box.style.display = "block";
    clearTimeout(window.navaiPwaMessageTimer);
    window.navaiPwaMessageTimer = setTimeout(() => {
      box.style.display = "none";
    }, 6500);
  }

  function mountButton() {
    if (isInstalled() || document.getElementById("navai-pwa-install")) return;

    const host =
      document.querySelector(".header-actions") ||
      document.querySelector(".nav-actions") ||
      document.querySelector("header nav") ||
      document.querySelector(".navbar .container") ||
      document.querySelector("header") ||
      document.querySelector("nav");

    if (!host) return;

    const button = document.createElement("button");
    button.id = "navai-pwa-install";
    button.type = "button";
    button.setAttribute("aria-label", "Install NavAI application");

    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3v12m-5-5 5 5 5-5"/>
        <path d="M5 17v3h14v-3"/>
      </svg>
      <span>Install NavAI</span>
    `;

    button.addEventListener("click", async () => {
      if (installPrompt) {
        installPrompt.prompt();
        const result = await installPrompt.userChoice;
        installPrompt = null;

        if (result.outcome === "accepted") {
          localStorage.setItem(KEY, "yes");
          button.remove();
        }
        return;
      }

      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

      if (isIOS) {
        showMessage("Safari mein Share button dabayein, phir Add to Home Screen select karein.");
      } else {
        showMessage("Browser ke menu (⋮) mein Install NavAI ya Create shortcut option select karein.");
      }
    });

    host.appendChild(button);
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    mountButton();
  });

  window.addEventListener("appinstalled", () => {
    localStorage.setItem(KEY, "yes");
    document.getElementById("navai-pwa-install")?.remove();
    showMessage("NavAI successfully installed!");
  });

  if (!isInstalled()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mountButton);
    } else {
      mountButton();
    }
  }

  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js", {scope: "/"})
        .catch(error => console.error("NavAI PWA:", error));
    });
  }
})();

(() => {
    "use strict";

    if (window.__NAVAI_INSTALL_V2__) return;
    window.__NAVAI_INSTALL_V2__ = true;

    const installed = () =>
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        navigator.standalone === true ||
        localStorage.getItem("navai_pwa_installed_v2") === "yes";

    let deferredPrompt = null;

    function createUI() {
        if (document.getElementById("navai-install-v2")) return;

        const bar = document.createElement("div");
        bar.id = "navai-install-v2";
        bar.hidden = installed();

        const icon = document.createElement("img");
        icon.className = "navai-install-icon";
        icon.src = "/static/pwa/navai-icon-192.png";
        icon.alt = "NavAI";

        const copy = document.createElement("div");
        copy.className = "navai-install-copy";
        copy.innerHTML =
            '<div class="navai-install-title">NavAI App</div>' +
            '<div class="navai-install-subtitle">Your learning space, one tap away</div>';

        const button = document.createElement("button");
        button.className = "navai-install-button";
        button.type = "button";
        button.textContent = "Install";

        bar.append(icon, copy, button);

        const overlay = document.createElement("div");
        overlay.id = "navai-install-overlay";
        overlay.hidden = true;

        const modal = document.createElement("div");
        modal.className = "navai-install-modal";

        const heading = document.createElement("h3");
        heading.textContent = "Install NavAI";

        const description = document.createElement("p");

        const close = document.createElement("button");
        close.type = "button";
        close.textContent = "Got it";

        modal.append(heading, description, close);
        overlay.append(modal);

        document.body.append(bar, overlay);

        function showInstructions() {
            if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                description.textContent =
                    "Open NavAI in Safari. Tap Share, then Add to Home Screen.";
            } else if (/Android/i.test(navigator.userAgent)) {
                description.textContent =
                    "Open Chrome menu (three dots) and select Install app if available. Choose Install, not Create shortcut.";
            } else {
                description.textContent =
                    "Use the install icon in your browser address bar or browser menu and choose Install NavAI.";
            }

            overlay.hidden = false;
        }

        close.addEventListener("click", () => {
            overlay.hidden = true;
        });

        overlay.addEventListener("click", e => {
            if (e.target === overlay) overlay.hidden = true;
        });

        button.addEventListener("click", async () => {
            if (!deferredPrompt) {
                showInstructions();
                return;
            }

            try {
                await deferredPrompt.prompt();
                const result = await deferredPrompt.userChoice;

                if (result.outcome === "accepted") {
                    bar.hidden = true;
                }

                deferredPrompt = null;
            } catch (error) {
                console.error("NavAI installation:", error);
                showInstructions();
            }
        });
    }

    function hideInstalled() {
        const bar = document.getElementById("navai-install-v2");
        if (bar) bar.hidden = true;
        localStorage.setItem("navai_pwa_installed_v2", "yes");
    }

    window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();
        deferredPrompt = event;

        if (!installed()) {
            createUI();
            const bar = document.getElementById("navai-install-v2");
            if (bar) bar.hidden = false;
        }
    });

    window.addEventListener("appinstalled", hideInstalled);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", createUI, {once:true});
    } else {
        createUI();
    }

    // Register the existing root service worker.
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("/service-worker.js", {
                scope: "/"
            }).catch(error => {
                console.error("NavAI service worker:", error);
            });
        }, {once:true});
    }
})();

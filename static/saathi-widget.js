(function () {
    "use strict";

    function createSaathiLauncher() {
        if (document.getElementById("navai-saathi-launcher")) return;

        const launcher = document.createElement("a");
        launcher.id = "navai-saathi-launcher";
        launcher.href = "/saathi";
        launcher.title = "NavAI Saathi";
        launcher.setAttribute("aria-label", "Open NavAI Saathi");
        launcher.innerHTML = `
            <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
                <path d="M24 5v5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                <circle cx="24" cy="4" r="2.5" fill="#fff"/>
                <rect x="8" y="11" width="32" height="29" rx="11"
                      fill="none" stroke="currentColor" stroke-width="2.5"/>
                <path d="M16 22h.2M31.8 22h.2"
                      stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                <path d="M17 30c2 3 4.2 4.5 7 4.5s5-1.5 7-4.5"
                      fill="none" stroke="currentColor" stroke-width="2.4"
                      stroke-linecap="round"/>
                <path d="M5 17l2 2m36-2-2 2"
                      stroke="#fff" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span class="navai-saathi-pulse" aria-hidden="true"></span>
        `;

        document.body.appendChild(launcher);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", createSaathiLauncher, { once: true });
    } else {
        createSaathiLauncher();
    }
})();
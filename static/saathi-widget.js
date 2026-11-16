(function () {
    "use strict";

    function createSaathiLauncher() {
        if (document.getElementById("navai-saathi-launcher")) return;

        const launcher = document.createElement("a");
        launcher.id = "navai-saathi-launcher";
        launcher.href = "/saathi";
        launcher.title = "Open NavAI Saathi";
        launcher.setAttribute("aria-label", "Open NavAI Saathi");

        launcher.innerHTML = `
            <svg viewBox="0 0 24 24" width="30" height="30"
                 aria-hidden="true" focusable="false">
                <path d="M12 3.2a7.2 7.2 0 0 0-7.2 7.2v3.1a2.5 2.5 0 0 0 2.5 2.5h.8v-5.2H6.8a5.2 5.2 0 0 1 10.4 0h-1.3V16h1.3a2.5 2.5 0 0 0 2.5-2.5v-3.1A7.2 7.2 0 0 0 12 3.2Z"
                      fill="none" stroke="currentColor" stroke-width="1.6"
                      stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M8.1 17.1c.8 1.5 2.1 2.3 3.9 2.3h1.4"
                      fill="none" stroke="currentColor" stroke-width="1.6"
                      stroke-linecap="round"/>
                <circle cx="14.8" cy="19.4" r="1" fill="currentColor"/>
            </svg>
        `;

        document.body.appendChild(launcher);
        console.info("NavAI Saathi launcher initialized.");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", createSaathiLauncher, { once: true });
    } else {
        createSaathiLauncher();
    }
})();

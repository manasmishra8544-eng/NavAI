(function () {
  "use strict";

  if (window.NavAIMath) return;

  let mathReady = false;
  let pending = [];
  let scheduled = false;

  window.MathJax = {
    tex: {
      inlineMath: [["\\(", "\\)"]],
      displayMath: [["\\[", "\\]"], ["$$", "$$"]],
      processEscapes: true,
      packages: { "[+]": ["ams"] }
    },
    options: {
      skipHtmlTags: [
        "script", "noscript", "style", "textarea",
        "pre", "code", "option"
      ]
    },
    startup: { typeset: false }
  };

  function typeset(nodes) {
    if (!mathReady || !window.MathJax || !window.MathJax.typesetPromise) {
      pending.push.apply(pending, nodes);
      return;
    }

    const valid = nodes.filter(node =>
      node &&
      node.isConnected &&
      !(node.closest && node.closest("mjx-container")) &&
      !node.matches?.("script,style,textarea,pre,code")
    );

    if (!valid.length) return;

    window.MathJax.typesetPromise(valid).catch(error => {
      console.warn("NavAI maths rendering:", error);
    });
  }

  function schedule(nodes) {
    pending.push.apply(pending, nodes);
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      const batch = [...new Set(pending)];
      pending = [];
      typeset(batch);
    });
  }

  window.NavAIMath = {
    render(root) {
      if (!root) return;
      schedule([root]);
    },
    ready() {
      return mathReady;
    }
  };

  const style = document.createElement("style");
  style.textContent = `
    mjx-container {
      max-width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 2px 0;
    }
    mjx-container[display="true"] {
      margin: 1em 0 !important;
    }
    .message-bubble mjx-container,
    #answer mjx-container,
    #board mjx-container,
    .step-copy mjx-container,
    .equation mjx-container {
      color: inherit;
    }
  `;
  document.head.appendChild(style);

  const script = document.createElement("script");
  script.src =
    "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
  script.async = true;

  script.onload = async () => {
    try {
      await window.MathJax.startup.promise;
      mathReady = true;

      const initial = document.body ? [document.body] : [];
      if (initial.length) schedule(initial);

      if (pending.length) {
        const batch = [...new Set(pending)];
        pending = [];
        typeset(batch);
      }
    } catch (error) {
      console.warn("NavAI maths renderer could not start:", error);
    }
  };

  script.onerror = () => {
    console.warn(
      "MathJax could not load. Check the internet connection or CDN access."
    );
  };

  document.head.appendChild(script);

  const observer = new MutationObserver(records => {
    const added = new Set();

    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (!node.closest("mjx-container")) added.add(node);
        } else if (
          node.nodeType === Node.TEXT_NODE &&
          record.target.nodeType === Node.ELEMENT_NODE &&
          !record.target.closest("mjx-container")
        ) {
          added.add(record.target);
        }
      }
    }

    if (added.size) schedule([...added]);
  });
  function startObserver() {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver, {
      once: true
    });
  } else {
    startObserver();
  }
})();

(() => {
  if (document.querySelector('[data-navai-handwritten-link]')) return;

  const link = document.createElement("a");
  link.href = "handwritten-notes.html";
  link.dataset.navaiHandwrittenLink = "true";
  link.textContent = "✍️  Handwritten Notes";
  link.title = "Create handwritten study notes";
  link.style.cssText =
    "display:flex;align-items:center;gap:10px;padding:12px 14px;" +
    "margin:8px 10px;border-radius:12px;color:inherit;" +
    "text-decoration:none;font-size:14px;";

  const candidates = [
    document.querySelector(".sidebar nav"),
    document.querySelector("#sidebar nav"),
    document.querySelector("aside nav"),
    document.querySelector(".sidebar"),
    document.querySelector("#sidebar"),
    document.querySelector("aside")
  ];

  const target = candidates.find(el => el && el.offsetWidth > 0);

  if (target) {
    target.appendChild(link);
  } else {
    link.style.cssText +=
      "position:fixed;left:12px;bottom:16px;z-index:9999;" +
      "background:#172554;color:white;box-shadow:0 4px 20px #0005;";
    document.body.appendChild(link);
  }
})();

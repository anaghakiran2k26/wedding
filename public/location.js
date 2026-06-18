(function () {
  const config = window.WEDDING_CONFIG || {};
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  qsa("[data-config]").forEach((node) => {
    const key = node.dataset.config;
    if (config[key]) node.textContent = config[key];
  });

  qsa("[data-map-link]").forEach((link) => {
    link.href = config.mapUrl || "#";
  });
})();

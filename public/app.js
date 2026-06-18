(function () {
  const config = window.WEDDING_CONFIG || {};
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function applyConfig() {
    qsa("[data-config]").forEach((node) => {
      const key = node.dataset.config;
      if (config[key]) node.textContent = config[key];
    });

    qsa("[data-map-link]").forEach((link) => {
      link.href = config.mapUrl || "#";
    });

    qsa("[data-drive-link]").forEach((link) => {
      link.href = config.engagementDriveUrl || "#";
      if (!config.engagementDriveUrl || config.engagementDriveUrl === "#") {
        link.setAttribute("aria-disabled", "true");
      }
    });

    const hero = qs(".hero-media");
    if (hero && config.heroImage) {
      hero.style.backgroundImage = `url("${config.heroImage}")`;
    }

    qsa("[data-image-config]").forEach((image) => {
      const key = image.dataset.imageConfig;
      if (config[key]) image.src = config[key];
    });
  }

  function setupRevealAnimation() {
    const items = qsa(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    items.forEach((item) => observer.observe(item));
  }

  function formatNumber(value) {
    return String(value).padStart(2, "0");
  }

  function setupCountdown() {
    const countdown = qs("#countdown");
    const title = qs("#countdownTitle");
    if (!countdown || !title) return;

    const weddingDate = config.weddingDate ? new Date(config.weddingDate) : null;
    if (!weddingDate || Number.isNaN(weddingDate.getTime())) {
      title.textContent = "Wedding date will be announced soon";
      return;
    }

    function tick() {
      const diff = weddingDate.getTime() - Date.now();
      if (diff <= 0) {
        title.textContent = "The celebration has begun";
        countdown.innerHTML = [
          ["00", "Days"],
          ["00", "Hours"],
          ["00", "Minutes"],
          ["00", "Seconds"]
        ]
          .map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`)
          .join("");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      title.textContent = weddingDate.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });

      countdown.innerHTML = [
        [days, "Days"],
        [formatNumber(hours), "Hours"],
        [formatNumber(minutes), "Minutes"],
        [formatNumber(seconds), "Seconds"]
      ]
        .map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`)
        .join("");
    }

    tick();
    setInterval(tick, 1000);
  }

  function photoCard(photo, index) {
    const button = document.createElement("button");
    button.className = "photo-card";
    button.type = "button";
    button.style.animationDelay = `${Math.min(index * 60, 420)}ms`;
    button.innerHTML = `
      <img src="${photo.src}" alt="${photo.title || "Wedding photo"}">
      <span>
        <strong>${photo.title || "Wedding memory"}</strong>
        <small>${photo.category || "Gallery"}</small>
      </span>
    `;
    button.addEventListener("click", () => openLightbox(photo));
    return button;
  }

  function renderEngagementPhotos() {
    const strip = qs("#engagementPhotos");
    if (!strip) return;
    const photos = config.engagementPhotos || [];
    strip.innerHTML = "";
    const featuredPhoto = photos[0];
    if (!featuredPhoto) return;
    strip.appendChild(photoCard(featuredPhoto, 0));
  }

  async function fetchUploadedPhotos() {
    try {
      const response = await fetch("/api/gallery", { cache: "no-store" });
      if (!response.ok) throw new Error("Gallery unavailable");
      const data = await response.json();
      return Array.isArray(data.photos) ? data.photos : [];
    } catch {
      return [];
    }
  }

  async function renderGallery() {
    const grid = qs("#galleryGrid");
    if (!grid) return;

    const uploaded = await fetchUploadedPhotos();
    const starter = Array.isArray(config.starterPhotos) ? config.starterPhotos : [];
    const photos = [...uploaded, ...starter];

    grid.innerHTML = "";
    if (!photos.length) {
      grid.innerHTML = '<p class="empty-note">Photos will be added soon.</p>';
      return;
    }

    photos.forEach((photo, index) => grid.appendChild(photoCard(photo, index)));
  }

  function openLightbox(photo) {
    const dialog = qs("#lightbox");
    const image = qs("#lightboxImage");
    const caption = qs("#lightboxCaption");
    if (!dialog || !image || !caption) return;

    image.src = photo.src;
    image.alt = photo.title || "Wedding photo";
    caption.textContent = `${photo.title || "Wedding memory"}${photo.category ? ` | ${photo.category}` : ""}`;
    dialog.showModal();
  }

  function setupLightbox() {
    const dialog = qs("#lightbox");
    const close = qs(".lightbox-close");
    if (!dialog || !close) return;

    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  function setupBlessings() {
    const form = qs("#blessingForm");
    if (!form) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = data.get("name") || "A well-wisher";
      const message = data.get("message") || "Blessings to Anagha and Kiran.";
      const body = encodeURIComponent(`${message}\n\n- ${name}`);
      window.location.href = `mailto:?subject=Blessings for Anagha and Kiran&body=${body}`;
    });
  }

  applyConfig();
  setupRevealAnimation();
  setupCountdown();
  renderEngagementPhotos();
  renderGallery();
  setupLightbox();
  setupBlessings();
})();

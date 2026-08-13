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

  function safeFileName(photo) {
    const title = photo.title || "wedding-photo";
    const path = photo.path || photo.src || "";
    const extension = (path.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i) || [".jpg"])[0].replace("?", "");
    return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "wedding-photo"}${extension}`;
  }

  async function downloadPhoto(photo) {
    if (!photo || !photo.src) return;

    try {
      const response = await fetch(photo.src);
      if (!response.ok) throw new Error("Download unavailable");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = safeFileName(photo);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(photo.src, "_blank", "noopener");
    }
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
    if (window.supabaseGallery && window.supabaseGallery.isEnabled()) {
      try {
        return await window.supabaseGallery.listPhotos();
      } catch {
        return [];
      }
    }

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
    const saveTheDateGrid = qs("#saveTheDateGrid");
    if (!grid && !saveTheDateGrid) return;

    const uploaded = await fetchUploadedPhotos();
    const starter = Array.isArray(config.starterPhotos) ? config.starterPhotos : [];
    const saveTheDateStarter = Array.isArray(config.saveTheDatePhotos) ? config.saveTheDatePhotos : [];
    const allPhotos = [...uploaded, ...starter];

    const saveTheDatePhotos = [
      ...allPhotos.filter((photo) => String(photo.category || "").toLowerCase() === "save the date"),
      ...saveTheDateStarter
    ];

    const weddingPhotos = allPhotos.filter(
      (photo) => String(photo.category || "").toLowerCase() !== "save the date"
    );

    if (saveTheDateGrid) {
      saveTheDateGrid.innerHTML = "";
      if (!saveTheDatePhotos.length) {
        saveTheDateGrid.innerHTML = '<p class="empty-note">Save the date photos will be added soon.</p>';
      } else {
        saveTheDatePhotos.forEach((photo, index) => saveTheDateGrid.appendChild(photoCard(photo, index)));
      }
    }

    if (grid) {
      grid.innerHTML = "";
      if (!weddingPhotos.length) {
        grid.innerHTML = '<p class="empty-note">Wedding gallery photos will be added soon.</p>';
        return;
      }

      weddingPhotos.forEach((photo, index) => grid.appendChild(photoCard(photo, index)));
    }
  }

  function openLightbox(photo) {
    const dialog = qs("#lightbox");
    const image = qs("#lightboxImage");
    const caption = qs("#lightboxCaption");
    const download = qs("#lightboxDownload");
    if (!dialog || !image || !caption) return;

    image.src = photo.src;
    image.alt = photo.title || "Wedding photo";
    caption.textContent = `${photo.title || "Wedding memory"}${photo.category ? ` | ${photo.category}` : ""}`;
    if (download) {
      download.onclick = () => downloadPhoto(photo);
    }
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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatWishTime(value) {
    if (!value) return "With blessings";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "With blessings";

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function renderWishes(wishes) {
    const list = qs("#wishesList");
    if (!list) return;

    if (!Array.isArray(wishes) || !wishes.length) {
      list.innerHTML = `
        <article class="wish-card wish-card-empty">
          <strong>Be the first to bless the couple</strong>
          <p>Your message will appear live here for Anagha and Kiran to cherish.</p>
        </article>
      `;
      return;
    }

    list.innerHTML = wishes
      .map(
        (wish) => `
          <article class="wish-card">
            <div class="wish-card-header">
              <strong>${escapeHtml(wish.name || "A well-wisher")}</strong>
              <span>${escapeHtml(formatWishTime(wish.createdAt))}</span>
            </div>
            <p>${escapeHtml(wish.message || "")}</p>
          </article>
        `
      )
      .join("");
  }

  async function loadWishes() {
    const status = qs("#blessingStatus");
    const list = qs("#wishesList");
    if (!list) return;

    if (!window.supabaseGallery || !window.supabaseGallery.isEnabled()) {
      renderWishes([]);
      if (status) status.textContent = "";
      return;
    }

    try {
      const wishes = await window.supabaseGallery.listWishes();
      renderWishes(wishes);
      if (status) status.textContent = "";
    } catch (error) {
      renderWishes([]);
      if (status) {
        status.textContent = error.message || "Unable to load wishes right now.";
        status.classList.add("is-error");
      }
    }
  }

  function setupBlessings() {
    const form = qs("#blessingForm");
    const status = qs("#blessingStatus");
    if (!form) return;

    loadWishes();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!window.supabaseGallery || !window.supabaseGallery.isEnabled()) {
        if (status) {
          status.textContent = "Live wishes are not ready yet.";
          status.classList.add("is-error");
        }
        return;
      }

      const data = new FormData(form);
      const name = String(data.get("name") || "").trim() || "A well-wisher";
      const message = String(data.get("message") || "").trim();

      if (!message) {
        if (status) {
          status.textContent = "Please write your blessing before sharing.";
          status.classList.add("is-error");
        }
        return;
      }

      if (status) {
        status.textContent = "Sharing your wish...";
        status.classList.remove("is-error");
      }

      try {
        const wishes = await window.supabaseGallery.addWish(name, message);
        renderWishes(wishes);
        form.reset();
        if (status) {
          status.textContent = "Your wish is now live on the page.";
          status.classList.remove("is-error");
        }
      } catch (error) {
        if (status) {
          status.textContent = error.message || "Unable to share your wish right now.";
          status.classList.add("is-error");
        }
      }
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

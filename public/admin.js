(function () {
  const tokenKey = "akWeddingAdminToken";
  const qs = (selector, root = document) => root.querySelector(selector);

  const loginCard = qs("#loginCard");
  const uploadCard = qs("#uploadCard");
  const savedCard = qs("#savedCard");
  const wishesCard = qs("#wishesCard");
  const loginForm = qs("#loginForm");
  const uploadForm = qs("#uploadForm");
  const logoutButton = qs("#logoutButton");
  const previewGrid = qs("#previewGrid");
  const savedGrid = qs("#savedGrid");
  const wishesAdminList = qs("#wishesAdminList");
  const loginStatus = qs("#loginStatus");
  const uploadStatus = qs("#uploadStatus");
  const wishesStatus = qs("#wishesStatus");
  const photoInput = qs("#photos");
  const emailRow = qs("#emailRow");
  const loginHint = qs("#loginHint");
  const emailInput = qs("#email");
  const useSupabase = Boolean(window.supabaseGallery && window.supabaseGallery.isEnabled());
  const isStaticHost =
    window.location.protocol === "https:" &&
    /github\.io$/i.test(window.location.hostname);

  async function parseJsonResponse(response) {
    const text = await response.text();

    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        useSupabase
          ? "Supabase response could not be read."
          : "This admin page needs Supabase or a real backend server. GitHub Pages cannot run /api/login."
      );
    }
  }

  function getFetchErrorMessage(error, action) {
    const localAdminUrl =
      window.location.protocol === "file:"
        ? "http://localhost:3000/admin.html"
        : `${window.location.origin}/admin.html`;

    if (isStaticHost && !useSupabase) {
      return "GitHub Pages cannot run the local upload backend. Enable Supabase in public/supabase-config.js or use localhost admin.";
    }

    if (window.location.protocol === "file:") {
      return `Admin ${action} works only through the local server. Open this page from ${localAdminUrl}`;
    }

    if (error && /Failed to fetch/i.test(error.message || "")) {
      return `Could not reach the server for ${action}. Open the admin page from ${localAdminUrl}`;
    }

    return error.message || `${action} failed.`;
  }

  function getToken() {
    return localStorage.getItem(tokenKey);
  }

  function configureLoginMode() {
    if (useSupabase) {
      if (emailRow) emailRow.classList.remove("is-hidden");
      if (emailInput) emailInput.required = true;
      if (loginHint) {
        loginHint.textContent =
          "Use your Supabase admin email and password to manage the gallery. If saving shows a bucket or permission error, run supabase-setup.sql once in Supabase SQL Editor.";
      }
      return;
    }

    if (emailRow) emailRow.classList.add("is-hidden");
    if (emailInput) emailInput.required = false;
    if (loginHint) {
      loginHint.textContent = isStaticHost
        ? "GitHub Pages cannot use the local upload backend. Turn on Supabase or use localhost."
        : "Local server mode is active for this device.";
    }
  }

  function setUnlocked(unlocked) {
    loginCard.classList.toggle("is-hidden", unlocked);
    uploadCard.classList.toggle("is-hidden", !unlocked);
    savedCard.classList.toggle("is-hidden", !unlocked);
    wishesCard.classList.toggle("is-hidden", !unlocked);
    if (unlocked) {
      loadSavedPhotos();
      loadSavedWishes();
    }
  }

  function setStatus(node, message, isError) {
    node.textContent = message || "";
    node.classList.toggle("is-error", Boolean(isError));
  }

  function safeFileName(photo) {
    const title = photo.title || "wedding-photo";
    const path = photo.path || photo.src || "";
    const extension = (path.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i) || [".jpg"])[0].replace("?", "");
    return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "wedding-photo"}${extension}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(loginStatus, "Checking access...");

    if (useSupabase) {
      try {
        await window.supabaseGallery.login(qs("#email").value, qs("#password").value);
        qs("#password").value = "";
        setStatus(loginStatus, "");
        setUnlocked(true);
      } catch (error) {
        setStatus(loginStatus, error.message || "Login failed.", true);
      }
      return;
    }

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: qs("#password").value })
      });
      const data = await parseJsonResponse(response);
      if (!response.ok) throw new Error(data.error || "Login failed.");

      localStorage.setItem(tokenKey, data.token);
      qs("#password").value = "";
      setStatus(loginStatus, "");
      setUnlocked(true);
    } catch (error) {
      setStatus(loginStatus, getFetchErrorMessage(error, "login"), true);
    }
  });

  logoutButton.addEventListener("click", () => {
    if (useSupabase) {
      window.supabaseGallery.logout().finally(() => setUnlocked(false));
      return;
    }

    localStorage.removeItem(tokenKey);
    setUnlocked(false);
  });

  photoInput.addEventListener("change", () => {
    previewGrid.innerHTML = "";
    Array.from(photoInput.files || []).forEach((file) => {
      const item = document.createElement("figure");
      const url = URL.createObjectURL(file);
      item.innerHTML = `
        <img src="${url}" alt="${file.name}">
        <figcaption>${file.name}</figcaption>
      `;
      previewGrid.appendChild(item);
    });
  });

  uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(uploadStatus, "Saving photos...");

    if (useSupabase) {
      try {
        const files = Array.from(photoInput.files || []);
        if (!files.length) throw new Error("Choose at least one photo.");

        const gallery = await window.supabaseGallery.uploadPhotos(
          files,
          qs("#photoTitle").value,
          qs("#photoCategory").value
        );

        uploadForm.reset();
        qs("#photoTitle").value = "Wedding memory";
        previewGrid.innerHTML = "";
        setStatus(uploadStatus, "Photos saved to the public gallery.");
        renderSavedPhotos(gallery || []);
      } catch (error) {
        setStatus(uploadStatus, error.message || "Upload failed.", true);
      }
      return;
    }

    try {
      const formData = new FormData(uploadForm);
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData
      });
      const data = await parseJsonResponse(response);
      if (!response.ok) throw new Error(data.error || "Upload failed.");

      uploadForm.reset();
      qs("#photoTitle").value = "Wedding memory";
      previewGrid.innerHTML = "";
      setStatus(uploadStatus, "Photos saved to the public gallery.");
      renderSavedPhotos(data.gallery || []);
    } catch (error) {
      setStatus(uploadStatus, getFetchErrorMessage(error, "upload"), true);
      if (/login/i.test(error.message)) {
        localStorage.removeItem(tokenKey);
        setUnlocked(false);
      }
    }
  });

  async function loadSavedPhotos() {
    if (useSupabase) {
      try {
        const photos = await window.supabaseGallery.listPhotos();
        renderSavedPhotos(photos || []);
      } catch {
        renderSavedPhotos([]);
      }
      return;
    }

    try {
      const response = await fetch("/api/gallery", { cache: "no-store" });
      const data = await parseJsonResponse(response);
      renderSavedPhotos(data.photos || []);
    } catch {
      renderSavedPhotos([]);
    }
  }

  async function loadSavedWishes() {
    if (!wishesAdminList) return;

    if (useSupabase) {
      try {
        const wishes = await window.supabaseGallery.listWishes();
        renderSavedWishes(wishes || []);
        setStatus(wishesStatus, "");
      } catch (error) {
        renderSavedWishes([]);
        setStatus(wishesStatus, error.message || "Could not load wishes.", true);
      }
      return;
    }

    renderSavedWishes([]);
    setStatus(wishesStatus, "Live wishes manager works with Supabase.", true);
  }

  function renderSavedPhotos(photos) {
    savedGrid.innerHTML = "";
    if (!photos.length) {
      savedGrid.innerHTML = '<p class="empty-note">No uploaded photos yet.</p>';
      return;
    }

    photos.forEach((photo) => {
      const article = document.createElement("article");
      article.className = "saved-photo";
      article.innerHTML = `
        <img src="${photo.src}" alt="${photo.title || "Wedding photo"}">
        <div>
          <strong>${photo.title || "Wedding memory"}</strong>
          <span>${photo.category || "Gallery"}</span>
        </div>
        <div class="saved-photo-actions">
          <button class="button button-small saved-download" type="button">Download</button>
          <button class="button button-small saved-delete" type="button">Delete</button>
        </div>
      `;

      article.querySelector(".saved-download").addEventListener("click", () => downloadPhoto(photo));
      article.querySelector(".saved-delete").addEventListener("click", () => deletePhoto(photo.path || photo.id));
      savedGrid.appendChild(article);
    });
  }

  function renderSavedWishes(wishes) {
    if (!wishesAdminList) return;

    wishesAdminList.innerHTML = "";
    if (!wishes.length) {
      wishesAdminList.innerHTML = '<p class="empty-note">No wishes yet.</p>';
      return;
    }

    wishes.forEach((wish) => {
      const article = document.createElement("article");
      article.className = "wish-admin-card";
      article.innerHTML = `
        <div class="wish-admin-head">
          <strong>${escapeHtml(wish.name || "A well-wisher")}</strong>
          <span>${formatWishDate(wish.createdAt)}</span>
        </div>
        <p>${escapeHtml(wish.message || "")}</p>
        <button class="button button-small saved-delete" type="button">Delete Wish</button>
      `;

      article
        .querySelector(".saved-delete")
        .addEventListener("click", () => deleteWish(wish.id));

      wishesAdminList.appendChild(article);
    });
  }

  function formatWishDate(value) {
    if (!value) return "Blessing";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Blessing";
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  async function deletePhoto(photoId) {
    if (!photoId) return;

    if (useSupabase) {
      try {
        const gallery = await window.supabaseGallery.deletePhoto(photoId);
        renderSavedPhotos(gallery || []);
      } catch (error) {
        setStatus(uploadStatus, error.message || "Could not delete photo.", true);
      }
      return;
    }

    try {
      const response = await fetch(`/api/gallery/${encodeURIComponent(photoId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await parseJsonResponse(response);
      if (!response.ok) throw new Error(data.error || "Could not delete photo.");
      renderSavedPhotos(data.gallery || []);
    } catch (error) {
      setStatus(uploadStatus, error.message, true);
    }
  }

  async function deleteWish(wishId) {
    if (!wishId || !useSupabase) return;

    try {
      const wishes = await window.supabaseGallery.deleteWish(wishId);
      renderSavedWishes(wishes || []);
      setStatus(wishesStatus, "Wish deleted.");
    } catch (error) {
      setStatus(wishesStatus, error.message || "Could not delete wish.", true);
    }
  }

  async function init() {
    configureLoginMode();

    if (useSupabase) {
      const session = await window.supabaseGallery.getSession();
      setUnlocked(Boolean(session));
      return;
    }

    setUnlocked(Boolean(getToken()));
  }

  init();
})();

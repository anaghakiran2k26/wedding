(function () {
  const tokenKey = "akWeddingAdminToken";
  const qs = (selector, root = document) => root.querySelector(selector);

  const loginCard = qs("#loginCard");
  const uploadCard = qs("#uploadCard");
  const savedCard = qs("#savedCard");
  const loginForm = qs("#loginForm");
  const uploadForm = qs("#uploadForm");
  const logoutButton = qs("#logoutButton");
  const previewGrid = qs("#previewGrid");
  const savedGrid = qs("#savedGrid");
  const loginStatus = qs("#loginStatus");
  const uploadStatus = qs("#uploadStatus");
  const photoInput = qs("#photos");

  function getFetchErrorMessage(error, action) {
    if (window.location.protocol === "file:") {
      return `Admin ${action} works only through the local server. Open this page from http://localhost:3000/admin.html`;
    }

    if (error && /Failed to fetch/i.test(error.message || "")) {
      return `Could not reach the server for ${action}. Open the admin page from http://localhost:3000/admin.html`;
    }

    return error.message || `${action} failed.`;
  }

  function getToken() {
    return localStorage.getItem(tokenKey);
  }

  function setUnlocked(unlocked) {
    loginCard.classList.toggle("is-hidden", unlocked);
    uploadCard.classList.toggle("is-hidden", !unlocked);
    savedCard.classList.toggle("is-hidden", !unlocked);
    if (unlocked) loadSavedPhotos();
  }

  function setStatus(node, message, isError) {
    node.textContent = message || "";
    node.classList.toggle("is-error", Boolean(isError));
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(loginStatus, "Checking access...");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: qs("#password").value })
      });
      const data = await response.json();
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

    try {
      const formData = new FormData(uploadForm);
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData
      });
      const data = await response.json();
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
    try {
      const response = await fetch("/api/gallery", { cache: "no-store" });
      const data = await response.json();
      renderSavedPhotos(data.photos || []);
    } catch {
      renderSavedPhotos([]);
    }
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
        <button class="button button-small" type="button">Delete</button>
      `;

      article.querySelector("button").addEventListener("click", () => deletePhoto(photo.id));
      savedGrid.appendChild(article);
    });
  }

  async function deletePhoto(id) {
    if (!id) return;

    try {
      const response = await fetch(`/api/gallery/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete photo.");
      renderSavedPhotos(data.gallery || []);
    } catch (error) {
      setStatus(uploadStatus, error.message, true);
    }
  }

  setUnlocked(Boolean(getToken()));
})();

(function () {
  const runtimeCache = { value: null, initialized: false };

  function getConfig() {
    return window.SUPABASE_CONFIG || {};
  }

  function getSetupMessage(config) {
    const bucketName = config && config.bucket ? config.bucket : "wedding-gallery";
    return `Supabase bucket "${bucketName}" is not ready yet. Open Supabase SQL Editor and run supabase-setup.sql once.`;
  }

  function getWishesSetupMessage() {
    return "Supabase wishes table is not ready yet. Open Supabase SQL Editor and run supabase-setup.sql once.";
  }

  function isReadyConfig(config) {
    return Boolean(
      config &&
        config.enabled &&
        config.url &&
        config.anonKey &&
        config.bucket &&
        window.supabase &&
        typeof window.supabase.createClient === "function"
    );
  }

  function normalizeError(error, config) {
    const message = String(
      (error && (error.message || error.error_description || error.msg)) || ""
    ).trim();

    if (/bucket.*not found/i.test(message)) {
      return new Error(getSetupMessage(config));
    }

    if (/relation .*wishes.* does not exist/i.test(message) || /could not find.*wishes/i.test(message)) {
      return new Error(getWishesSetupMessage());
    }

    if (/row-level security|violates row-level security/i.test(message)) {
      if (/wishes/i.test(message)) {
        return new Error(
          "Supabase wishes permissions are not ready yet. Open Supabase SQL Editor and run supabase-setup.sql once."
        );
      }

      return new Error(
        "Supabase storage permissions are not ready yet. Open Supabase SQL Editor and run supabase-setup.sql once."
      );
    }

    if (/invalid login credentials/i.test(message)) {
      return new Error("The email or password is incorrect.");
    }

    if (/email not confirmed/i.test(message)) {
      return new Error("This Supabase email is not confirmed yet. Confirm it first, then log in again.");
    }

    return new Error(message || "Supabase request failed.");
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
  }

  function splitName(fileName) {
    const lastDot = fileName.lastIndexOf(".");
    if (lastDot === -1) return { base: fileName, ext: "" };
    return {
      base: fileName.slice(0, lastDot),
      ext: fileName.slice(lastDot)
    };
  }

  function parseStoredName(fileName) {
    const { base } = splitName(fileName);
    const parts = base.split("__");
    if (parts.length < 3) {
      return {
        title: "Wedding memory",
        category: "Gallery"
      };
    }

    const title = parts[1]
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    const category = parts[2]
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    return {
      title: title || "Wedding memory",
      category: category || "Gallery"
    };
  }

  function buildStoredName(file, title, category) {
    const { ext } = splitName(file.name || "");
    const safeTitle = slugify(title) || "wedding-memory";
    const safeCategory = slugify(category) || "gallery";
    const random = Math.random().toString(36).slice(2, 8);
    return `${Date.now()}-${random}__${safeTitle}__${safeCategory}${ext || ".jpg"}`;
  }

  function buildPhotoRecord(client, bucket, folder, item) {
    const fileName = item.name || "";
    const path = folder ? `${folder}/${fileName}` : fileName;
    const { data } = client.storage.from(bucket).getPublicUrl(path);
    const meta = parseStoredName(fileName);

    return {
      id: path,
      path,
      src: data.publicUrl,
      title: meta.title,
      category: meta.category,
      uploadedAt: item.created_at || ""
    };
  }

  function sortPhotosNewestFirst(photos) {
    return [...photos].sort((a, b) => {
      const aTime = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const bTime = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  function sortWishesNewestFirst(wishes) {
    return [...wishes].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  function getRuntime() {
    if (runtimeCache.initialized) return runtimeCache.value;
    runtimeCache.initialized = true;

    const config = getConfig();
    if (!isReadyConfig(config)) {
      runtimeCache.value = null;
      return runtimeCache.value;
    }

    runtimeCache.value = {
      client: window.supabase.createClient(config.url, config.anonKey),
      bucket: config.bucket,
      folder: config.folder || "gallery"
    };

    return runtimeCache.value;
  }

  async function listPhotos() {
    const runtime = getRuntime();
    if (!runtime) return [];

    const { client, bucket, folder } = runtime;
    const { data, error } = await client.storage.from(bucket).list(folder, {
      limit: 100,
      sortBy: { column: "name", order: "desc" }
    });

    if (error) throw normalizeError(error, getConfig());

    const photos = (data || [])
      .filter((item) => item.name && !item.name.endsWith("/"))
      .map((item) => buildPhotoRecord(client, bucket, folder, item));

    return sortPhotosNewestFirst(photos);
  }

  async function login(email, password) {
    const runtime = getRuntime();
    if (!runtime) throw new Error("Supabase is not configured yet.");

    const { error, data } = await runtime.client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw normalizeError(error, getConfig());
    return data;
  }

  async function getSession() {
    const runtime = getRuntime();
    if (!runtime) return null;
    const { data } = await runtime.client.auth.getSession();
    return data.session || null;
  }

  async function logout() {
    const runtime = getRuntime();
    if (!runtime) return;
    await runtime.client.auth.signOut();
  }

  async function uploadPhotos(files, title, category) {
    const runtime = getRuntime();
    if (!runtime) throw new Error("Supabase is not configured yet.");

    const { client, bucket, folder } = runtime;
    const uploads = [];

    for (const file of files) {
      const fileName = buildStoredName(file, title, category);
      const path = folder ? `${folder}/${fileName}` : fileName;
      const { error } = await client.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined
      });

      if (error) throw normalizeError(error, getConfig());
      uploads.push(path);
    }

    return listPhotos();
  }

  async function deletePhoto(path) {
    const runtime = getRuntime();
    if (!runtime) throw new Error("Supabase is not configured yet.");

    const { client, bucket } = runtime;
    const { error } = await client.storage.from(bucket).remove([path]);
    if (error) throw normalizeError(error, getConfig());

    return listPhotos();
  }

  async function listWishes() {
    const runtime = getRuntime();
    if (!runtime) return [];

    const { data, error } = await runtime.client
      .from("wishes")
      .select("id, name, message, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw normalizeError(error, getConfig());

    const wishes = (data || []).map((item) => ({
      id: item.id,
      name: item.name || "A well-wisher",
      message: item.message || "",
      createdAt: item.created_at || ""
    }));

    return sortWishesNewestFirst(wishes);
  }

  async function addWish(name, message) {
    const runtime = getRuntime();
    if (!runtime) throw new Error("Supabase is not configured yet.");

    const payload = {
      name: String(name || "A well-wisher").trim() || "A well-wisher",
      message: String(message || "").trim()
    };

    const { error } = await runtime.client.from("wishes").insert(payload);
    if (error) throw normalizeError(error, getConfig());

    return listWishes();
  }

  async function deleteWish(id) {
    const runtime = getRuntime();
    if (!runtime) throw new Error("Supabase is not configured yet.");

    const { error } = await runtime.client.from("wishes").delete().eq("id", id);
    if (error) throw normalizeError(error, getConfig());

    return listWishes();
  }

  window.supabaseGallery = {
    isEnabled() {
      return Boolean(getRuntime());
    },
    listPhotos,
    login,
    getSession,
    logout,
    uploadPhotos,
    deletePhoto,
    listWishes,
    addWish,
    deleteWish
  };
})();

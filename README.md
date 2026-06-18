# Anagha & Kiran Wedding Invitation

Premium Kerala-style marriage invitation website with a public gallery and admin upload page.

## Backend modes

This project now supports two gallery backends:

1. Local Node upload server
2. Supabase Storage

If Supabase is configured in `public/supabase-config.js`, the gallery and admin page use Supabase automatically.

## Run locally

```bash
npm start
```

Open:

- Public invitation: `http://localhost:3000`
- Admin upload page: `http://localhost:3000/admin.html`

Default local admin password:

```text
ANAGHA@2000
```

## Supabase setup

Update `public/supabase-config.js`:

```js
window.SUPABASE_CONFIG = {
  enabled: true,
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
  bucket: "wedding-gallery",
  folder: "gallery"
};
```

Create in Supabase:

1. A public storage bucket named `wedding-gallery`
2. An auth user for the admin page
3. Storage policies that allow:
   - public read access for the gallery folder
   - authenticated upload/delete access for admin users

Ready-to-run SQL is included in:

```text
supabase-setup.sql
```

On the admin page, log in with the Supabase admin email and password.

## Edit wedding details

Update `public/config.js`.

Important fields:

- `weddingDate`: add the real date in this format: `YYYY-MM-DDT09:30:00+05:30`
- `engagementDriveUrl`: paste the Google Drive folder link
- `heroImage`: replace with the couple hero photo path
- `starterPhotos`: public gallery photos bundled with the website
- `engagementPhotos`: engagement memory photos

## Replace photos manually

Hero photo:

```text
public/assets/images/anagha-kiran-hero.jpeg
```

Engagement photos:

```text
public/assets/engagement/
```

Starter gallery photos:

```text
public/assets/gallery/
```

## Local server storage

If you keep local server mode, uploaded admin photos are saved here:

```text
uploads/gallery/
```

The local upload server keeps the gallery list in:

```text
data/gallery.json
```

## Deploy notes

- GitHub Pages can show the public site only
- GitHub Pages cannot run the local Node upload backend
- Supabase mode is the better choice for cross-device public hosting

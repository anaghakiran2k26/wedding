# Anagha & Kiran Wedding Invitation

Premium Kerala-style marriage invitation website with a public gallery and password-protected photo upload admin page.

## Run locally

```bash
npm start
```

Open:

- Public invitation: `http://localhost:3000`
- Admin upload page: `http://localhost:3000/admin.html`

Default admin password:

```text
ak-family-2026
```

For publishing, set a stronger password:

```bash
ADMIN_PASSWORD="your-secure-password" npm start
```

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

Uploaded admin photos are saved here:

```text
uploads/gallery/
```

The upload server keeps the gallery list in:

```text
data/gallery.json
```

## Deploy notes

This project uses only built-in Node.js modules, so no extra packages are required.

Deploy it to a Node-capable host such as Render, Railway, Fly.io, a VPS, or any shared host that supports persistent file storage. If your host has temporary storage, uploaded photos may disappear after redeploys. For long-term production hosting, connect uploads to Firebase Storage, S3, or another persistent storage provider.

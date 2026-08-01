# My Vault — Setup & Deployment Guide

A private personal site for notes, photos, and videos.
Frontend: plain HTML/CSS/JS (hosted free on GitHub Pages).
Backend: Google Apps Script (free, no server to manage).
Storage: Your own Google Drive (a folder called "PersonalVault").

---

## Part 1 — Set up the backend (Google Apps Script)

1. Go to **script.google.com** and click **New project**.
2. Delete the default empty code, then paste in the entire contents of
   `appscript/Code.gs` from this project.
3. Set your password:
   - In `Code.gs`, find the `setPassword()` function near the top.
   - Change `"YOUR_NEW_PASSWORD"` to a real password of your choosing.
   - In the toolbar dropdown (next to the "Run" ▶ button), select
     **setPassword**, then click **Run**.
   - The first time, Google will ask you to authorize the script — click
     through **Review permissions → (your account) → Advanced → Go to
     project (unsafe) → Allow**. This "unsafe" warning is normal for
     scripts you write yourself; it's just Google being cautious.
   - Check **View > Logs** — you should see "Password set."
   - Now go back and change that line back to a placeholder (or just leave
     it — the stored password isn't affected by re-running unless you
     click Run again with a new value).

4. **Deploy as a Web App:**
   - Click **Deploy → New deployment**.
   - Click the gear icon next to "Select type" and choose **Web app**.
   - Description: `Vault API v1`.
   - **Execute as:** Me (your account).
   - **Who has access:** Anyone.
     *(Don't worry — "Anyone" only means anyone can reach the URL; they
     still need your password to log in, and every action after login
     requires a valid session token.)*
   - Click **Deploy**.
   - Authorize again if asked.
   - Copy the **Web app URL** — it looks like:
     `https://script.google.com/macros/s/AKfycb.../exec`
   - Keep this tab open; you'll need this URL in Part 2.

5. A folder called **PersonalVault** will be created automatically in your
   Google Drive the first time you save a note or upload a file — you
   don't need to create it manually.

**Re-deploying later:** if you edit `Code.gs` after this, you must create
a **new deployment** (Deploy → Manage deployments → pencil icon → New
version) for changes to take effect on the live URL.

---

## Part 2 — Connect the frontend to your backend

1. Open `js/api.js` in this project.
2. Replace:
   ```js
   const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
   ```
   with the Web App URL you copied in Part 1, e.g.:
   ```js
   const API_URL = "https://script.google.com/macros/s/AKfycbXXXXXXXX/exec";
   ```
3. Save the file.

---

## Part 3 — Put the frontend on GitHub Pages

1. Create a **new GitHub repository** (can be public — the site has no
   secrets in it; your password is never stored in this code, only
   hashed on Google's servers).
2. Upload these files/folders, keeping the same structure:
   ```
   index.html
   dashboard.html
   css/style.css
   js/api.js
   js/app.js
   ```
   (You don't need to upload the `appscript/` folder — that code lives in
   Apps Script, not on GitHub.)
3. In the repo, go to **Settings → Pages**.
4. Under **Source**, choose **Deploy from a branch**, branch = `main`,
   folder = `/ (root)`. Click **Save**.
5. Wait a minute, then GitHub will show your live URL, e.g.:
   `https://yourusername.github.io/your-repo-name/`
6. Open that URL — you should see the login screen. Enter the password
   you set in Part 1.

---

## Part 4 — Test it

- Log in with your password.
- Click **+ New note**, add a title and some text, click **Save**.
- Switch to **Photos & Videos**, click **+ Upload photo/video**, pick an
  image from your device.
- Refresh the page — your note and photo should still be there (they're
  saved in your Google Drive, not in the browser).
- Open the same URL on your phone and log in — same data appears, since
  it all lives in your Drive.

---

## How your data is organized in Drive

```
My Drive/
└── PersonalVault/
    ├── notes_index.json     (all your notes, one JSON file)
    ├── media_index.json     (catalog of uploaded files)
    ├── Images/
    │     photo1.jpg
    │     photo2.png
    ├── Videos/
    │     clip1.mp4
```

You can open `PersonalVault` in Drive any time to see or back up your raw
files. Nothing is shared publicly — files stay in your private Drive.

---

## Security notes

- Your password is never stored in plain text — it's hashed (SHA-256) in
  Apps Script's Script Properties, which are only readable by you as the
  script owner.
- Sessions expire after 12 hours (`SESSION_HOURS` in `Code.gs`) — after
  that you'll need to log in again.
- The Apps Script Web App URL is not secret-sensitive by itself (every
  request still needs your password or a valid token), but don't post it
  publicly if you want to be extra cautious.
- For stronger security later, you could add rate-limiting on failed
  logins, or swap the password model for Google Sign-In — ask if you'd
  like that added.

---

## Customizing

- **Change session length:** edit `SESSION_HOURS` in `Code.gs`.
- **Change the app name / folder name:** edit `ROOT_FOLDER_NAME` in
  `Code.gs`.
- **Dark/light mode:** already built in — toggle with the moon/sun icon
  in the top bar.
- **Add more fields to notes** (e.g. favorites, folders): extend the
  `note` object in `app.js` and the `saveNote` function in `Code.gs`.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Could not reach server" on login | `API_URL` in `js/api.js` wasn't updated, or you haven't redeployed after editing `Code.gs` |
| Login says "No password set on server yet" | Run `setPassword()` from the Apps Script editor once |
| Notes/photos don't show up | Check the Apps Script **Executions** log (left sidebar) for errors |
| Changes to `Code.gs` don't show up | You edited the code but didn't create a **new deployment version** |

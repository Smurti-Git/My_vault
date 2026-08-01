/**
 * PERSONAL VAULT - Apps Script Backend
 * ------------------------------------
 * One file. Handles:
 *  - login (password check + session token)
 *  - notes CRUD (stored as one JSON index file in Drive)
 *  - media upload/list/delete (photos + videos stored as real files in Drive,
 *    indexed in a JSON file)
 *
 * SETUP (also see README):
 *  1. Run `setPassword()` once from the Apps Script editor (Run button) after
 *     changing YOUR_NEW_PASSWORD below, then delete/blank that line out.
 *  2. Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone.
 *  3. Copy the Web App URL into js/api.js on the frontend.
 */

const ROOT_FOLDER_NAME = "PersonalVault";
const NOTES_FILE_NAME = "notes_index.json";
const MEDIA_FILE_NAME = "media_index.json";
const SESSION_HOURS = 12;

// ---------- ONE-TIME SETUP ----------
// Edit the password below, run this function ONCE from the editor (select
// setPassword in the dropdown, click Run), then you can clear the string.
function setPassword() {
  const password = "YOUR_NEW_PASSWORD"; // <-- change this, run once, then remove
  const props = PropertiesService.getScriptProperties();
  props.setProperty("PASSWORD_HASH", hashString(password));
  Logger.log("Password set.");
}

// ---------- ENTRY POINTS ----------
function doGet(e) {
  return jsonOutput({ ok: true, message: "Vault API is running" });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const action = body.action;

    // Every action except "login" requires a valid token
    if (action !== "login") {
      const valid = checkToken(body.token);
      if (!valid) return jsonOutput({ ok: false, error: "Invalid or expired session" });
    }

    switch (action) {
      case "login":
        return jsonOutput(handleLogin(body.password));
      case "getNotes":
        return jsonOutput({ ok: true, notes: getNotesIndex() });
      case "saveNote":
        return jsonOutput({ ok: true, note: saveNote(body.note) });
      case "deleteNote":
        return jsonOutput({ ok: true, deleted: deleteNote(body.id) });
      case "getMedia":
        return jsonOutput({ ok: true, media: getMediaIndex() });
      case "uploadMedia":
        return jsonOutput({ ok: true, item: uploadMedia(body.file) });
      case "deleteMedia":
        return jsonOutput({ ok: true, deleted: deleteMedia(body.id) });
      case "getMediaFile":
        return jsonOutput({ ok: true, file: getMediaFile(body.id) });
      default:
        return jsonOutput({ ok: false, error: "Unknown action: " + action });
    }
  } catch (err) {
    return jsonOutput({ ok: false, error: err.message });
  }
}

// ---------- AUTH ----------
function handleLogin(password) {
  const props = PropertiesService.getScriptProperties();
  const storedHash = props.getProperty("PASSWORD_HASH");
  if (!storedHash) return { ok: false, error: "No password set on server yet." };
  if (hashString(password) !== storedHash) return { ok: false, error: "Wrong password" };

  const token = Utilities.getUuid();
  const expires = new Date().getTime() + SESSION_HOURS * 60 * 60 * 1000;
  props.setProperty("TOKEN_" + token, String(expires));
  return { ok: true, token: token };
}

function checkToken(token) {
  if (!token) return false;
  const props = PropertiesService.getScriptProperties();
  const expires = props.getProperty("TOKEN_" + token);
  if (!expires) return false;
  if (new Date().getTime() > Number(expires)) {
    props.deleteProperty("TOKEN_" + token);
    return false;
  }
  return true;
}

function hashString(str) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str);
  return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")).join("");
}

// ---------- DRIVE HELPERS ----------
function getRootFolder() {
  const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(ROOT_FOLDER_NAME);
}

function getSubFolder(name) {
  const root = getRootFolder();
  const folders = root.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return root.createFolder(name);
}

function readJsonFile(folder, fileName) {
  const files = folder.getFilesByName(fileName);
  if (!files.hasNext()) return [];
  const content = files.next().getBlob().getDataAsString();
  try {
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

function writeJsonFile(folder, fileName, data) {
  const files = folder.getFilesByName(fileName);
  const json = JSON.stringify(data, null, 2);
  if (files.hasNext()) {
    files.next().setContent(json);
  } else {
    folder.createFile(fileName, json, MimeType.PLAIN_TEXT);
  }
}

// ---------- NOTES ----------
function getNotesIndex() {
  const root = getRootFolder();
  return readJsonFile(root, NOTES_FILE_NAME);
}

function saveNote(note) {
  const root = getRootFolder();
  const notes = readJsonFile(root, NOTES_FILE_NAME);
  const now = new Date().toISOString();

  if (note.id) {
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx > -1) {
      notes[idx] = Object.assign({}, notes[idx], note, { updated: now });
    } else {
      notes.push(Object.assign({}, note, { updated: now, created: now }));
    }
  } else {
    note.id = "note-" + Utilities.getUuid();
    note.created = now;
    note.updated = now;
    notes.push(note);
  }

  writeJsonFile(root, NOTES_FILE_NAME, notes);
  return note;
}

function deleteNote(id) {
  const root = getRootFolder();
  let notes = readJsonFile(root, NOTES_FILE_NAME);
  const before = notes.length;
  notes = notes.filter(n => n.id !== id);
  writeJsonFile(root, NOTES_FILE_NAME, notes);
  return notes.length < before;
}

// ---------- MEDIA (photos/videos) ----------
function getMediaIndex() {
  const root = getRootFolder();
  return readJsonFile(root, MEDIA_FILE_NAME);
}

// file = { name, mimeType, base64, type: "image"|"video" }
function uploadMedia(file) {
  const folderName = file.type === "video" ? "Videos" : "Images";
  const folder = getSubFolder(folderName);

  const bytes = Utilities.base64Decode(file.base64);
  const blob = Utilities.newBlob(bytes, file.mimeType, file.name);
  const driveFile = folder.createFile(blob);
  // Keep files private to the owner; do NOT setSharing to anyone.

  const root = getRootFolder();
  const media = readJsonFile(root, MEDIA_FILE_NAME);
  const item = {
    id: "media-" + Utilities.getUuid(),
    driveId: driveFile.getId(),
    name: file.name,
    type: file.type,
    mimeType: file.mimeType,
    uploaded: new Date().toISOString()
  };
  media.push(item);
  writeJsonFile(root, MEDIA_FILE_NAME, media);
  return item;
}

function deleteMedia(id) {
  const root = getRootFolder();
  let media = readJsonFile(root, MEDIA_FILE_NAME);
  const item = media.find(m => m.id === id);
  if (item) {
    try {
      DriveApp.getFileById(item.driveId).setTrashed(true);
    } catch (e) {
      // file already gone; ignore
    }
  }
  const before = media.length;
  media = media.filter(m => m.id !== id);
  writeJsonFile(root, MEDIA_FILE_NAME, media);
  return media.length < before;
}

// Returns { name, mimeType, base64 } for a media item so the frontend can
// render <img>/<video> previews. Fine for personal-scale files; if you
// start storing very large videos, consider streaming via a public
// (unlisted) share link instead.
function getMediaFile(id) {
  const root = getRootFolder();
  const media = readJsonFile(root, MEDIA_FILE_NAME);
  const item = media.find(m => m.id === id);
  if (!item) throw new Error("Media not found");
  const driveFile = DriveApp.getFileById(item.driveId);
  const blob = driveFile.getBlob();
  return {
    name: item.name,
    mimeType: item.mimeType,
    base64: Utilities.base64Encode(blob.getBytes())
  };
}

function doOptions(e) {
  return ContentService.createTextOutput("");
}

// ---------- OUTPUT ----------
function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

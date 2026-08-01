// Guard: bounce to login if no token
if (!localStorage.getItem("vault_token")) {
  window.location.href = "index.html";
}

// ---------- THEME ----------
const themeBtn = document.getElementById("toggleTheme");
const savedTheme = localStorage.getItem("vault_theme") || "dark";
if (savedTheme === "light") {
  document.documentElement.setAttribute("data-theme", "light");
  themeBtn.textContent = "☀️";
}
themeBtn.addEventListener("click", () => {
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  if (isLight) {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("vault_theme", "dark");
    themeBtn.textContent = "🌙";
  } else {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("vault_theme", "light");
    themeBtn.textContent = "☀️";
  }
});

// ---------- LOGOUT ----------
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("vault_token");
  window.location.href = "index.html";
});

// ---------- TABS ----------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab + "-tab").classList.add("active");
  });
});

// ---------- NOTES ----------
let allNotes = [];
let activeNoteId = null;

async function loadNotes() {
  const res = await VaultAPI.getNotes();
  if (res.ok) {
    allNotes = res.notes.sort((a, b) => new Date(b.updated) - new Date(a.updated));
    renderNotes(allNotes);
  }
}

function renderNotes(notes) {
  const list = document.getElementById("notesList");
  if (notes.length === 0) {
    list.innerHTML = `<div class="empty-state">No notes yet. Click "+ New note" to add your first one.</div>`;
    return;
  }
  list.innerHTML = notes.map(n => `
    <div class="note-card" data-id="${n.id}">
      <h3>${escapeHtml(n.title || "Untitled")}</h3>
      <p>${escapeHtml((n.content || "").slice(0, 140))}</p>
      <div class="note-meta">${new Date(n.updated).toLocaleDateString()}</div>
    </div>
  `).join("");

  list.querySelectorAll(".note-card").forEach(card => {
    card.addEventListener("click", () => openNoteEditor(card.dataset.id));
  });
}

document.getElementById("noteSearch").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = allNotes.filter(n =>
    (n.title || "").toLowerCase().includes(q) ||
    (n.content || "").toLowerCase().includes(q) ||
    (n.tags || []).join(",").toLowerCase().includes(q)
  );
  renderNotes(filtered);
});

const noteModal = document.getElementById("noteModal");
document.getElementById("newNoteBtn").addEventListener("click", () => openNoteEditor(null));
document.getElementById("cancelNoteBtn").addEventListener("click", () => noteModal.classList.add("hidden"));

function openNoteEditor(id) {
  activeNoteId = id;
  const note = id ? allNotes.find(n => n.id === id) : null;
  document.getElementById("noteTitle").value = note ? note.title : "";
  document.getElementById("noteContent").value = note ? note.content : "";
  document.getElementById("noteTags").value = note ? (note.tags || []).join(", ") : "";
  document.getElementById("deleteNoteBtn").style.display = note ? "inline-block" : "none";
  noteModal.classList.remove("hidden");
}

document.getElementById("saveNoteBtn").addEventListener("click", async () => {
  const note = {
    id: activeNoteId,
    title: document.getElementById("noteTitle").value.trim() || "Untitled",
    content: document.getElementById("noteContent").value,
    tags: document.getElementById("noteTags").value.split(",").map(t => t.trim()).filter(Boolean)
  };
  const btn = document.getElementById("saveNoteBtn");
  btn.disabled = true;
  btn.textContent = "Saving...";
  await VaultAPI.saveNote(note);
  btn.disabled = false;
  btn.textContent = "Save";
  noteModal.classList.add("hidden");
  loadNotes();
});

document.getElementById("deleteNoteBtn").addEventListener("click", async () => {
  if (!activeNoteId) return;
  if (!confirm("Delete this note?")) return;
  await VaultAPI.deleteNote(activeNoteId);
  noteModal.classList.add("hidden");
  loadNotes();
});

// ---------- MEDIA ----------
let allMedia = [];
let activeMediaId = null;

async function loadMedia() {
  const res = await VaultAPI.getMedia();
  if (res.ok) {
    allMedia = res.media.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
    renderMedia();
  }
}

function renderMedia() {
  const grid = document.getElementById("mediaGrid");
  if (allMedia.length === 0) {
    grid.innerHTML = `<div class="empty-state">No photos or videos yet.</div>`;
    return;
  }
  grid.innerHTML = allMedia.map(m => `
    <div class="media-thumb" data-id="${m.id}">${m.type === "video" ? "🎬" : "🖼️"}</div>
  `).join("");
  grid.querySelectorAll(".media-thumb").forEach(el => {
    el.addEventListener("click", () => openMediaPreview(el.dataset.id));
  });
}

document.getElementById("mediaInput").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  const status = document.getElementById("uploadStatus");

  for (const file of files) {
    status.textContent = `Uploading ${file.name}...`;
    const base64 = await fileToBase64(file);
    const type = file.type.startsWith("video") ? "video" : "image";
    await VaultAPI.uploadMedia({
      name: file.name,
      mimeType: file.type,
      base64,
      type
    });
  }
  status.textContent = "Done.";
  setTimeout(() => (status.textContent = ""), 2000);
  e.target.value = "";
  loadMedia();
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const mediaModal = document.getElementById("mediaModal");
document.getElementById("closeMediaBtn").addEventListener("click", () => mediaModal.classList.add("hidden"));

async function openMediaPreview(id) {
  activeMediaId = id;
  const item = allMedia.find(m => m.id === id);
  const content = document.getElementById("mediaPreviewContent");
  content.innerHTML = `<p style="color:var(--text-dim)">Loading ${escapeHtml(item.name)}...</p>`;
  mediaModal.classList.remove("hidden");

  const res = await VaultAPI.getMediaFile(id);
  if (!res.ok) {
    content.innerHTML = `<p style="color:var(--danger)">Could not load file.</p>`;
    return;
  }
  const src = `data:${res.file.mimeType};base64,${res.file.base64}`;
  content.innerHTML = item.type === "video"
    ? `<video src="${src}" controls></video>`
    : `<img src="${src}" alt="${escapeHtml(item.name)}">`;
}

document.getElementById("deleteMediaBtn").addEventListener("click", async () => {
  if (!activeMediaId) return;
  if (!confirm("Delete this file?")) return;
  await VaultAPI.deleteMedia(activeMediaId);
  mediaModal.classList.add("hidden");
  loadMedia();
});

// ---------- UTIL ----------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ---------- INIT ----------
loadNotes();
loadMedia();

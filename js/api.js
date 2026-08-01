/**
 * Talks to the Google Apps Script backend.
 *
 * IMPORTANT: after you deploy Code.gs as a Web App (see README), paste the
 * deployment URL below. It looks like:
 * https://script.google.com/macros/s/AKfycb.../exec
 */
const API_URL = "https://script.google.com/macros/s/AKfycbxWGBhXhsZuViuLbW8qU_lsj-YBbOIfblS3SbDjed1rBlUJ6cp9IW-zCASKM-dFm-wK9Q/exec";

const VaultAPI = (() => {
  function getToken() {
    return localStorage.getItem("vault_token");
  }

  async function call(action, payload = {}) {
    const body = Object.assign({ action, token: getToken() }, payload);
    const res = await fetch(API_URL, {
      method: "POST",
      // text/plain avoids a CORS preflight against Apps Script
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.ok === false && data.error === "Invalid or expired session") {
      localStorage.removeItem("vault_token");
      window.location.href = "index.html";
    }
    return data;
  }

  return {
    login: (password) => call("login", { password }),
    getNotes: () => call("getNotes"),
    saveNote: (note) => call("saveNote", { note }),
    deleteNote: (id) => call("deleteNote", { id }),
    getMedia: () => call("getMedia"),
    getMediaFile: (id) => call("getMediaFile", { id }),
    uploadMedia: (file) => call("uploadMedia", { file }),
    deleteMedia: (id) => call("deleteMedia", { id })
  };
})();

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const statusEl = document.getElementById("status");
const resultBox = document.getElementById("result");
const shareUrlInput = document.getElementById("shareUrlInput");
const fileUrlText = document.getElementById("fileUrlText");
const copyBtn = document.getElementById("copyBtn");

let selectedFile = null;

// Click on drop zone -> open file picker
dropZone.addEventListener("click", () => fileInput.click());

// File chosen via input
fileInput.addEventListener("change", (e) => {
  if (e.target.files && e.target.files[0]) {
    selectedFile = e.target.files[0];
    statusEl.textContent = "Selected: " + selectedFile.name;
  }
});

// Drag & drop events
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    selectedFile = e.dataTransfer.files[0];
    fileInput.files = e.dataTransfer.files;
    statusEl.textContent = "Selected: " + selectedFile.name;
  }
});

// Backend base URL (Render)
const BACKEND_URL = "https://droplink-pro-1.onrender.com";

// Upload & generate link
uploadBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    statusEl.textContent = "Please choose a file first.";
    return;
  }

  uploadBtn.disabled = true;
  statusEl.textContent = "Uploading...";
  resultBox.style.display = "none";

  try {
    const formData = new FormData();
    formData.append("file", selectedFile);

    const res = await fetch(`${BACKEND_URL}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Upload failed");
    }

    const data = await res.json();
    statusEl.textContent = data.message || "Upload successful.";

    // Share URL (prefer backend-provided; fallback build from id)
    if (data.shareUrl) {
      shareUrlInput.value = data.shareUrl;
    } else {
      shareUrlInput.value = data.id ? `${BACKEND_URL}/file/${encodeURIComponent(data.id)}` : "";
    }

    // Direct file URL
    if (data.fileUrl) {
      fileUrlText.innerHTML = `<a href="${data.fileUrl}" target="_blank">${data.fileUrl}</a>`;
    } else {
      fileUrlText.textContent = "Not available.";
    }

    resultBox.style.display = "block";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error: " + err.message;
  } finally {
    uploadBtn.disabled = false;
  }
});

// Copy share URL
copyBtn.addEventListener("click", async () => {
  const url = shareUrlInput.value.trim();
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
  } catch {
    alert("Copy failed, please copy manually.");
  }
});

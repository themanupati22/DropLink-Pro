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

  // Client-side guard: enforce 1GB max to show instant feedback
  const MAX_BYTES = 1024 * 1024 * 1024; // 1GB
  if (selectedFile.size > MAX_BYTES) {
    statusEl.textContent = "File too large. Maximum allowed is 1GB.";
    return;
  }

  uploadBtn.disabled = true;
  statusEl.textContent = "Uploading...";
  resultBox.style.display = "none";
  const overlay = document.getElementById("uploadOverlay");
  const progressText = document.getElementById("uploadProgressText");
  const progressBar = document.getElementById("uploadProgressBar");
  if (overlay) overlay.style.display = "flex";
  if (progressText) progressText.textContent = "Uploading… 0%";
  if (progressBar) progressBar.style.width = "0%";

  try {
    const formData = new FormData();
    formData.append("file", selectedFile);

    // Use XHR for upload progress
    const xhr = new XMLHttpRequest();
    const url = `${BACKEND_URL}/upload`;
    const data = await new Promise((resolve, reject) => {
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        if (progressText) progressText.textContent = `Uploading… ${pct}%`;
        if (progressBar) progressBar.style.width = `${pct}%`;
      };
      xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          const ct = xhr.getResponseHeader("content-type") || "";
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const payload = ct.includes("application/json") ? JSON.parse(xhr.responseText) : {};
              resolve(payload);
            } catch {
              resolve({});
            }
          } else {
            let message = "Upload failed";
            if (ct.includes("application/json")) {
              try {
                const err = JSON.parse(xhr.responseText);
                message = err.error || err.message || message;
              } catch {}
            } else if (xhr.status === 413) {
              message = "File too large. Maximum allowed is 1GB.";
            }
            reject(new Error(message));
          }
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.open("POST", url);
      xhr.send(formData);
    });
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
    if (overlay) overlay.style.display = "none";
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

// server.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;



const metadataPath = path.join(__dirname, "fileMetadata.json");

// Helpers to load/save metadata
function loadMetadata() {
  try {
    if (!fs.existsSync(metadataPath)) return {};
    const raw = fs.readFileSync(metadataPath, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Error reading metadata:", e);
    return {};
  }
}

function saveMetadata(data) {
  try {
    fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Error writing metadata:", e);
  }
}

// Human-readable file size
function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(2)} ${sizes[i]}`;
}


// Middleware
app.use(cors());
// Serve static files. In Render, prefer serving from a local 'public' folder.
// If you keep frontend outside backend, deploy it separately and use CORS.
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}


// Multer disk storage – files are saved to disk
const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// Static file access for inline preview
app.use("/files", express.static(uploadDir));

// Explicit download route to force attachment
app.get("/files/:name/download", (req, res) => {
  const fileName = req.params.name;
  const filePath = path.join(uploadDir, fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  // Set headers to suggest download
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(/^\d+-/, "")}"`);
  res.download(filePath, fileName.replace(/^\d+-/, ""));
});

app.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const id = req.file.filename; // unique ID
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;
    const size = req.file.size;
    const storedName = req.file.filename;

    const fileUrl = `${req.protocol}://${req.get("host")}/files/${storedName}`;
    const shareUrl = `${req.protocol}://${req.get("host")}/file/${encodeURIComponent(id)}`;

    // Save metadata
    const meta = loadMetadata();
    meta[id] = {
      id,
      originalName,
      mimeType,
      size,
      storedName,
      fileUrl,
      createdAt: new Date().toISOString(),
    };
    saveMetadata(meta);

    res.json({
      message: "Upload successful",
      id,
      shareUrl,
      fileUrl,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Public API to get metadata (optional, for debugging)
app.get("/api/file/:id", (req, res) => {
  const meta = loadMetadata();
  const file = meta[req.params.id];
  if (!file) return res.status(404).json({ error: "File not found" });
  res.json(file);
});

// Share page route – this is the URL you share
app.get("/file/:id", (req, res) => {
  const meta = loadMetadata();
  const file = meta[req.params.id];
  if (!file) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>File Not Found</title>
        <style>
          body { 
            margin:0; display:flex; align-items:center; justify-content:center;
            min-height:100vh; background:#020617; color:#e5e7eb; font-family:system-ui;
          }
          .card {
            background:#0f172a; padding:24px 28px; border-radius:16px;
            border:1px solid rgba(148,163,184,0.5); max-width:400px; text-align:center;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>❌ File not found</h2>
          <p>The link may be incorrect or the file was removed.</p>
        </div>
      </body>
      </html>
    `);
  }

  const readableSize = formatBytes(file.size);

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Download: ${file.originalName}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        * { box-sizing:border-box; font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
              body {
                margin:0; height:100vh; overflow:hidden; display:flex; align-items:center; justify-content:center;
                background:#ffffff; color:#1f2937;
              }
              .card {
                background:#ffffff; border-radius:18px; padding:24px 24px 26px;
                width:100%; max-width:520px; border:1px solid #e5e7eb;
                box-shadow:0 12px 40px rgba(17,24,39,0.12);
              }
        h1 {
          margin:0 0 10px;
          font-size:1.15rem;
          font-weight:700;
        }
        .hero {
          text-align:center;
          margin-bottom:16px;
        }
        .hero-title {
          font-size:1.35rem;
          font-weight:800;
          margin:0 0 6px;
        }
        .brand-blue { color:#2563eb; }
        .text-black { color:#111827; }
        .hero-sub {
          font-size:0.85rem;
          color:#9ca3af;
        }
        .bottom-actions {
          display:flex;
          justify-content:center;
          margin-top:18px;
          padding:0;
        }
        .meta {
          font-size:0.9rem;
          color:#9ca3af;
          margin-bottom:16px;
        }
        .meta-row { margin-bottom:4px; }
              .label { font-weight:600; color:#111827; }
              .value { color:#374151; word-break:break-all; }
        .btn {
          display:inline-flex; align-items:center; justify-content:center;
          gap:8px; padding:16px 30px; border-radius:999px;
          border:1px solid #111827; cursor:pointer; font-size:1.06rem; font-weight:800;
          background:#111827; color:#ffffff; text-decoration:none; margin-top:12px;
          width:320px; max-width:100%;
        }
        .btn:hover { transform:translateY(-1px); box-shadow:0 10px 25px rgba(56,189,248,0.35); }
        .note { margin-top:10px; font-size:0.8rem; color:#6b7280; }
          .preview {
            margin-top:14px; padding-top:10px; border-top:1px dashed #d1d5db;
            font-size:0.85rem; color:#6b7280;
          }
          .preview-box {
            margin-top:8px; border-radius:12px; overflow:hidden; height:480px; /* fixed height, no outer scroll */
            background:#ffffff; box-shadow:inset 0 0 0 1px #e5e7eb;
          }
        img.preview-img {
          display:block; width:100%; height:auto; border-radius:12px;
        }
        .iframe-wrap { width:100%; height:100%; border-radius:12px; overflow:hidden; }
        iframe.preview-frame {
          width:100%; height:100%; border:none; border-radius:12px; margin:0;
          background:#ffffff; display:block; overflow:hidden;
        }
        @media (max-width: 480px) {
          .card { padding: 16px; }
          .hero-title { font-size: 1.1rem; }
          h1 { font-size: 1rem; }
          .preview { padding-top: 8px; }
          .preview-box { height: 360px; }
          .btn { width: 280px; padding: 12px 18px; font-size: 0.95rem; }
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="hero">
          <div class="hero-title"><span class="brand-blue">DropLink Pro</span> <span class="text-black">shared file with you</span></div>
          <div class="hero-sub">Find file details below</div>
        </div>

        <h1>📁 ${file.originalName}</h1>
        <div class="meta">
          <div class="meta-row">
            <span class="label">Type:</span>
            <span class="value">${file.mimeType}</span>
          </div>
          <div class="meta-row">
            <span class="label">Size:</span>
            <span class="value">${readableSize}</span>
          </div>
        </div>

        <div class="preview">
          <div>Preview (if supported by browser):</div>
          <div class="preview-box">
            ${
              file.mimeType.startsWith("image/")
                ? `<img class="preview-img" src="${file.fileUrl}" alt="preview" />`
                : file.mimeType === "application/pdf"
                ? `<div class="iframe-wrap"><iframe class="preview-frame" src="${file.fileUrl}#toolbar=0&navpanes=0&scrollbar=0" scrolling="no"></iframe></div>`
                : `<div style="padding:12px;">Preview not available for this file type.</div>`
            }
          </div>
        </div>

        <div class="bottom-actions">
          <a class="btn" href="/files/${file.storedName}/download">⬇ Download File</a>
        </div>

        <div class="note">
          Share this page URL so others can see the file info and download it.
        </div>
      </div>
    </body>
    </html>
  `);
});

// Start server

// Periodically delete files older than 10 minutes
setInterval(() => {
  const meta = loadMetadata();
  const now = Date.now();
  let changed = false;
  for (const id in meta) {
    const file = meta[id];
    const created = new Date(file.createdAt).getTime();
    if (now - created > 10 * 60 * 1000) { // 10 minutes
      // Delete file from disk
      const filePath = path.join(uploadDir, file.storedName);
      try { fs.unlinkSync(filePath); } catch {}
      // Remove metadata
      delete meta[id];
      changed = true;
    }
  }
  if (changed) saveMetadata(meta);
}, 60 * 1000); // Check every minute

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import os from "os";
import archiver from "archiver";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);

const SOFFICE_PATH = "/nix/store/j261ykwr6mxvai0v22sa9y6w421p30ay-libreoffice-7.6.7.2-wrapped/bin/soffice";
const SESSIONS_DIR = path.join(os.tmpdir(), "pptx-converter-sessions");

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pptx|ppt)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Only .pptx and .ppt files are allowed"));
    }
  },
});

async function convertPptxToImages(pptxBuffer: Buffer, filename: string, sessionDir: string): Promise<string[]> {
  const inputPath = path.join(sessionDir, filename);
  const pdfPath = path.join(sessionDir, "presentation.pdf");
  fs.writeFileSync(inputPath, pptxBuffer);

  await execFileAsync(SOFFICE_PATH, [
    "--headless",
    "--norestore",
    "--nologo",
    "--nofirststartwizard",
    "--convert-to", "pdf",
    "--outdir", sessionDir,
    inputPath,
  ], { timeout: 120000 });

  if (!fs.existsSync(pdfPath)) {
    const pdfFiles = fs.readdirSync(sessionDir).filter(f => f.endsWith(".pdf"));
    if (pdfFiles.length === 0) {
      throw new Error("PDF conversion failed — no PDF output produced");
    }
    fs.renameSync(path.join(sessionDir, pdfFiles[0]), pdfPath);
  }

  await execFileAsync("pdftoppm", [
    "-png",
    "-r", "300",
    pdfPath,
    path.join(sessionDir, "slide"),
  ], { timeout: 120000 });

  const files = fs.readdirSync(sessionDir)
    .filter(f => f.endsWith(".png"))
    .sort((a, b) => {
      const numA = parseInt(a.match(/(\d+)/)?.[1] ?? "0");
      const numB = parseInt(b.match(/(\d+)/)?.[1] ?? "0");
      return numA - numB;
    });

  fs.unlinkSync(inputPath);
  fs.unlinkSync(pdfPath);
  return files;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/convert", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const sessionId = randomUUID();
      const sessionDir = path.join(SESSIONS_DIR, sessionId);
      fs.mkdirSync(sessionDir, { recursive: true });

      const safeFilename = "presentation" + path.extname(req.file.originalname).toLowerCase();

      const imageFiles = await convertPptxToImages(req.file.buffer, safeFilename, sessionDir);

      if (imageFiles.length === 0) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        return res.status(500).json({ message: "Conversion produced no images. The file may be corrupt or empty." });
      }

      const slides = imageFiles.map((filename, index) => ({
        slideNumber: index + 1,
        filename,
        url: `/api/slides/${sessionId}/${filename}`,
      }));

      setTimeout(() => {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }, 2 * 60 * 60 * 1000);

      return res.json({
        sessionId,
        totalSlides: slides.length,
        originalFilename: req.file.originalname,
        slides,
      });
    } catch (err: any) {
      console.error("Conversion error:", err);
      return res.status(500).json({ message: err.message || "Conversion failed" });
    }
  });

  app.get("/api/slides/:sessionId/:filename", (req, res) => {
    const { sessionId, filename } = req.params;
    if (!/^[a-f0-9-]+$/.test(sessionId) || !/^[a-zA-Z0-9._-]+\.png$/.test(filename)) {
      return res.status(400).json({ message: "Invalid path" });
    }
    const filePath = path.join(SESSIONS_DIR, sessionId, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Image not found" });
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.sendFile(filePath);
  });

  app.get("/api/download-all/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    if (!/^[a-f0-9-]+$/.test(sessionId)) {
      return res.status(400).json({ message: "Invalid session ID" });
    }
    const sessionDir = path.join(SESSIONS_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
      return res.status(404).json({ message: "Session not found or expired" });
    }

    const files = fs.readdirSync(sessionDir).filter(f => f.endsWith(".png")).sort();
    if (files.length === 0) {
      return res.status(404).json({ message: "No images found" });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="slides.zip"`);

    const archive = archiver("zip", { zlib: { level: 0 } });
    archive.on("error", (err) => {
      console.error("Archive error:", err);
      if (!res.headersSent) res.status(500).json({ message: "Failed to create ZIP" });
    });
    archive.pipe(res);
    files.forEach((f, i) => {
      const padded = String(i + 1).padStart(3, "0");
      archive.file(path.join(sessionDir, f), { name: `slide-${padded}.png` });
    });
    archive.finalize();
  });

  return httpServer;
}

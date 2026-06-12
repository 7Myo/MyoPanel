import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { config } from "../config/env.js";
import { requireAuth, requireWriteAccess } from "../middleware/auth.js";
import { asyncHandler, HttpError, sendCreated } from "../utils/http.js";
import { analyzeUploadedZip, confirmImport } from "../services/importService.js";
import { db } from "../db/client.js";

export const importsRouter = Router();

const upload = multer({
  dest: path.join(config.tempDir, "uploads"),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith(".zip")) cb(new HttpError(400, "Seuls les fichiers ZIP sont acceptes."));
    else cb(null, true);
  }
});

importsRouter.use(requireAuth);

importsRouter.get("/", requireWriteAccess, (_req, res) => {
  const imports = db.prepare("SELECT * FROM imports ORDER BY created_at DESC LIMIT 50").all().map(mapImport);
  res.json({ imports });
});

importsRouter.post("/upload", requireWriteAccess, upload.single("botZip"), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, "Fichier ZIP requis.");
  const result = await analyzeUploadedZip({ file: req.file, userId: req.user.id });
  sendCreated(res, result);
}));

importsRouter.post("/:id/confirm", requireWriteAccess, asyncHandler(async (req, res) => {
  const bot = await confirmImport(req.params.id, {
    name: req.body.name,
    description: req.body.description,
    installDependencies: req.body.installDependencies !== false,
    startNow: req.body.startNow !== false
  });
  res.json({ bot });
}));

function mapImport(row) {
  return {
    id: row.id,
    originalName: row.original_name,
    safeName: row.safe_name,
    analysis: JSON.parse(row.analysis_json || "{}"),
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    error: row.error
  };
}

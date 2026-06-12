import { Router } from "express";
import { db } from "../db/client.js";
import { requireAuth, requireWriteAccess } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { deleteBackup, listBackups, restoreBackup } from "../services/backupService.js";

export const backupsRouter = Router();

backupsRouter.use(requireAuth);

backupsRouter.get("/", (req, res) => {
  res.json({ backups: listBackups(req.query.botId) });
});

backupsRouter.get("/:id/download", (req, res, next) => {
  const backup = db.prepare("SELECT * FROM backups WHERE id = ?").get(req.params.id);
  if (!backup) return next(new HttpError(404, "Sauvegarde introuvable."));
  res.download(backup.file_path);
});

backupsRouter.post("/:id/restore", requireWriteAccess, asyncHandler(async (req, res) => {
  await restoreBackup(req.params.id);
  res.json({ restored: true });
}));

backupsRouter.delete("/:id", requireWriteAccess, asyncHandler(async (req, res) => {
  await deleteBackup(req.params.id);
  res.status(204).end();
}));

import fs from "fs-extra";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import archiver from "archiver";
import unzipper from "unzipper";
import { randomUUID } from "node:crypto";
import { config } from "../config/env.js";
import { db, nowIso } from "../db/client.js";
import { addLog } from "./logService.js";
import { stopBot, startBot } from "./pm2Service.js";
import { HttpError } from "../utils/http.js";

export async function createBackup(botId, userId, note = "") {
  const bot = db.prepare("SELECT * FROM bots WHERE id = ?").get(botId);
  if (!bot) throw new HttpError(404, "Bot introuvable.");

  const botBackupDir = path.join(config.backupsDir, bot.slug);
  await fs.ensureDir(botBackupDir);
  const backupId = randomUUID();
  const filePath = path.join(botBackupDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${bot.slug}.zip`);

  await zipDirectory(bot.project_path, filePath);
  const stat = await fs.stat(filePath);
  const now = nowIso();

  db.prepare(`
    INSERT INTO backups (id, bot_id, file_path, format, size_bytes, created_by, created_at, note)
    VALUES (?, ?, ?, 'zip', ?, ?, ?, ?)
  `).run(backupId, botId, filePath, stat.size, userId, now, note);

  addLog({ botId, source: "backup", level: "info", message: `Sauvegarde creee pour ${bot.name}` });
  return db.prepare("SELECT * FROM backups WHERE id = ?").get(backupId);
}

export function listBackups(botId) {
  const rows = botId
    ? db.prepare("SELECT * FROM backups WHERE bot_id = ? ORDER BY created_at DESC").all(botId)
    : db.prepare(`
        SELECT backups.*, bots.name AS bot_name
        FROM backups
        JOIN bots ON bots.id = backups.bot_id
        ORDER BY backups.created_at DESC
      `).all();
  return rows.map(mapBackup);
}

export async function deleteBackup(id) {
  const backup = db.prepare("SELECT * FROM backups WHERE id = ?").get(id);
  if (!backup) throw new HttpError(404, "Sauvegarde introuvable.");
  await fs.remove(backup.file_path);
  db.prepare("DELETE FROM backups WHERE id = ?").run(id);
}

export async function restoreBackup(id) {
  const backup = db.prepare("SELECT * FROM backups WHERE id = ?").get(id);
  if (!backup) throw new HttpError(404, "Sauvegarde introuvable.");
  const bot = db.prepare("SELECT * FROM bots WHERE id = ?").get(backup.bot_id);
  if (!bot) throw new HttpError(404, "Bot introuvable.");

  await createBackup(bot.id, null, "Sauvegarde automatique avant restauration");
  await stopBot(bot).catch(() => null);
  await fs.emptyDir(bot.project_path);
  await extractSafeZip(backup.file_path, bot.project_path);
  await startBot(bot).catch(() => null);
  addLog({ botId: bot.id, source: "backup", level: "warning", message: `Sauvegarde restauree pour ${bot.name}` });
}

async function zipDirectory(sourceDir, outPath) {
  await fs.ensureDir(path.dirname(outPath));
  const output = fs.createWriteStream(outPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  const complete = new Promise((resolve, reject) => {
    output.on("close", resolve);
    archive.on("error", reject);
  });

  archive.pipe(output);
  archive.directory(sourceDir, false);
  await archive.finalize();
  await complete;
}

async function extractSafeZip(zipPath, targetDir) {
  const directory = await unzipper.Open.file(zipPath);
  const targetRoot = path.resolve(targetDir);
  for (const entry of directory.files) {
    const destination = path.resolve(targetRoot, entry.path);
    if (!destination.startsWith(`${targetRoot}${path.sep}`) && destination !== targetRoot) {
      throw new HttpError(400, "Sauvegarde invalide: chemin dangereux detecte.");
    }
    if (entry.type === "Directory") await fs.ensureDir(destination);
    else {
      await fs.ensureDir(path.dirname(destination));
      await pipeline(entry.stream(), fs.createWriteStream(destination));
    }
  }
}

export function mapBackup(row) {
  return {
    id: row.id,
    botId: row.bot_id,
    botName: row.bot_name,
    filePath: row.file_path,
    format: row.format,
    sizeBytes: row.size_bytes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    note: row.note
  };
}

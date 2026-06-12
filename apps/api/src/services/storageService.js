import fs from "node:fs/promises";
import path from "node:path";
import si from "systeminformation";
import { config } from "../config/env.js";
import { db } from "../db/client.js";

export async function getStorageSummary() {
  const [panel, bots, logs, backups, database, temp, diskInfo] = await Promise.all([
    directorySize(config.workspaceRoot),
    directorySize(config.botsDir),
    directorySize(config.logsDir),
    directorySize(config.backupsDir),
    fileSize(config.dbPath),
    directorySize(config.tempDir),
    getDiskInfo()
  ]);

  const botRows = db.prepare("SELECT id, name, project_path FROM bots ORDER BY name").all();
  const perBot = [];
  for (const bot of botRows) {
    const project = await directorySize(bot.project_path);
    const nodeModules = await directorySize(path.join(bot.project_path, "node_modules"));
    const backupsSize = await botBackupsSize(bot.id);
    perBot.push({
      id: bot.id,
      name: bot.name,
      project,
      nodeModules,
      logs: 0,
      backups: backupsSize,
      total: project + backupsSize
    });
  }

  return {
    breakdown: {
      panel,
      bots,
      logs,
      backups,
      database,
      temp,
      nodeModules: perBot.reduce((sum, bot) => sum + bot.nodeModules, 0)
    },
    perBot,
    disk: diskInfo
  };
}

export async function directorySize(dir) {
  let total = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await directorySize(fullPath);
    else if (entry.isFile()) total += await fileSize(fullPath);
  }
  return total;
}

async function fileSize(filePath) {
  const stat = await fs.stat(filePath).catch(() => null);
  return stat?.size || 0;
}

async function botBackupsSize(botId) {
  const rows = db.prepare("SELECT size_bytes FROM backups WHERE bot_id = ?").all(botId);
  return rows.reduce((sum, row) => sum + row.size_bytes, 0);
}

async function getDiskInfo() {
  try {
    const fsSize = await si.fsSize();
    const primary = Array.isArray(fsSize) ? fsSize.find((d) => d.mount === "/") || fsSize[0] : null;
    if (primary) {
      return {
        total: primary.size || 0,
        used: primary.used || 0,
        available: primary.available || 0,
        use: Math.round((primary.use || 0) * 10) / 10,
        mount: primary.mount || "/",
        fs: primary.fs || "unknown"
      };
    }
  } catch {}
  return null;
}

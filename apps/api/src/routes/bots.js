import fs from "fs-extra";
import { Router } from "express";
import path from "node:path";
import { db, nowIso } from "../db/client.js";
import { requireAuth, canManageBots } from "../middleware/auth.js";
import { asyncHandler, HttpError, sendCreated } from "../utils/http.js";
import { addLog, listLogs, tailFile } from "../services/logService.js";
import { createBackup, listBackups } from "../services/backupService.js";
import { analyzeCommands, mapCommand, replaceBotCommands } from "../services/commandAnalyzer.js";
import { deleteBot, describeProcess, listProcesses, mapPm2Process, restartBot, startBot, stopBot } from "../services/pm2Service.js";
import { config } from "../config/env.js";
import { randomUUID } from "node:crypto";
import { slugify, uniqueSlug } from "../utils/slug.js";

export const botsRouter = Router();

botsRouter.use(requireAuth);

function managedProjectPath(value) {
  const projectPath = path.resolve(String(value || ""));
  const relative = path.relative(config.botsDir, projectPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new HttpError(400, "Le projet doit etre situe dans le dossier gere des bots.");
  }
  return projectPath;
}

async function validateEntrypoint(projectPath, entrypoint) {
  const value = String(entrypoint || "").trim();
  if (!value || path.isAbsolute(value)) throw new HttpError(400, "Point d'entree invalide.");
  const script = path.resolve(projectPath, value);
  const relative = path.relative(projectPath, script);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new HttpError(400, "Le point d'entree doit rester dans le projet.");
  }
  const stat = await fs.stat(script).catch(() => null);
  if (!stat?.isFile()) throw new HttpError(400, "Le point d'entree est introuvable.");
  return value;
}

botsRouter.get("/", asyncHandler(async (_req, res) => {
  const bots = db.prepare("SELECT * FROM bots ORDER BY created_at DESC").all();
  const pm2 = await safePm2List();
  res.json({ bots: bots.map((bot) => mapBot(bot, pm2.get(bot.pm2_name))) });
}));

botsRouter.post("/", canManageBots, asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const projectPath = managedProjectPath(req.body.projectPath);
  const entrypoint = String(req.body.entrypoint || "").trim();
  if (!name || !projectPath || !entrypoint) throw new HttpError(400, "Nom, chemin projet et point d'entree requis.");
  if (!await fs.pathExists(projectPath)) throw new HttpError(400, "Chemin projet introuvable.");
  const validEntrypoint = await validateEntrypoint(projectPath, entrypoint);

  const slug = uniqueSlug(name, (candidate) => Boolean(db.prepare("SELECT id FROM bots WHERE slug = ?").get(candidate)));
  const id = randomUUID();
  const botToken = randomUUID() + randomUUID();
  const now = nowIso();
  db.prepare(`
    INSERT INTO bots (id, name, slug, description, project_path, entrypoint, pm2_name, bot_token, status, install_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'stopped', 'ready', ?, ?)
  `).run(id, name, slug, req.body.description || "", projectPath, validEntrypoint, `myos-${slug}`, botToken, now, now);

  const commands = await analyzeCommands(projectPath);
  replaceBotCommands(id, commands);
  sendCreated(res, { bot: mapBot(db.prepare("SELECT * FROM bots WHERE id = ?").get(id)) });
}));

botsRouter.get("/:id", asyncHandler(async (req, res) => {
  const bot = getBot(req.params.id);
  const entrypoint = req.body.entrypoint === undefined
    ? bot.entrypoint
    : await validateEntrypoint(managedProjectPath(bot.project_path), req.body.entrypoint);
  const pm2 = await safeDescribe(bot.pm2_name);
  res.json({ bot: mapBot(bot, pm2), backups: listBackups(bot.id) });
}));

botsRouter.patch("/:id", canManageBots, asyncHandler(async (req, res) => {
  const bot = getBot(req.params.id);
  db.prepare(`
    UPDATE bots
    SET name = @name, description = @description, enabled = @enabled, entrypoint = @entrypoint, updated_at = @updated_at
    WHERE id = @id
  `).run({
    id: bot.id,
    name: req.body.name ?? bot.name,
    description: req.body.description ?? bot.description,
    enabled: req.body.enabled === undefined ? bot.enabled : (req.body.enabled ? 1 : 0),
    entrypoint,
    updated_at: nowIso()
  });
  res.json({ bot: mapBot(getBot(bot.id)) });
}));

botsRouter.delete("/:id", canManageBots, asyncHandler(async (req, res) => {
  const bot = getBot(req.params.id);
  await deleteBot(bot);
  if (req.query.removeFiles === "true") {
    const projectPath = managedProjectPath(bot.project_path);
    await createBackup(bot.id, req.user.id, "Sauvegarde automatique avant suppression");
    await fs.remove(projectPath);
  }
  db.prepare("DELETE FROM bots WHERE id = ?").run(bot.id);
  addLog({ source: "pm2", level: "warning", message: `Bot retire du panel: ${bot.name}` });
  res.status(204).end();
}));

botsRouter.post("/:id/actions/:action", canManageBots, asyncHandler(async (req, res) => {
  const bot = getBot(req.params.id);
  const action = req.params.action;

  if (action === "start") {
    await startBot(bot);
    updateBotStatus(bot.id, "online", true);
  } else if (action === "stop") {
    await stopBot(bot);
    updateBotStatus(bot.id, "stopped");
  } else if (action === "restart") {
    await restartBot(bot);
    updateBotStatus(bot.id, "online", true);
  } else if (action === "refresh-commands") {
    const commands = await analyzeCommands(bot.project_path);
    replaceBotCommands(bot.id, commands);
  } else {
    throw new HttpError(400, "Action inconnue.");
  }

  addLog({ botId: bot.id, source: "pm2", level: "info", message: `Action ${action} executee sur ${bot.name}` });
  res.json({ bot: mapBot(getBot(bot.id), await safeDescribe(bot.pm2_name)) });
}));

botsRouter.get("/:id/commands", (req, res) => {
  getBot(req.params.id);
  const commands = db.prepare("SELECT * FROM commands WHERE bot_id = ? ORDER BY category, name").all(req.params.id).map(mapCommand);
  res.json({ commands });
});

botsRouter.get("/:id/logs", asyncHandler(async (req, res) => {
  const bot = getBot(req.params.id);
  const logs = listLogs({ botId: bot.id, level: req.query.level, source: req.query.source, search: req.query.search, limit: req.query.limit });
  let pm2Tail = null;
  const pm2 = await safeDescribe(bot.pm2_name);
  const logPath = pm2?.errorLogPath || pm2?.outLogPath;
  if (logPath) pm2Tail = await tailFile(logPath).catch(() => null);
  res.json({ logs, pm2Tail });
}));

botsRouter.post("/:id/backups", canManageBots, asyncHandler(async (req, res) => {
  const backup = await createBackup(req.params.id, req.user.id, req.body.note || "");
  sendCreated(res, { backup });
}));

function getBot(id) {
  const bot = db.prepare("SELECT * FROM bots WHERE id = ?").get(id);
  if (!bot) throw new HttpError(404, "Bot introuvable.");
  return bot;
}

function updateBotStatus(id, status, started = false) {
  db.prepare("UPDATE bots SET status = ?, updated_at = ?, last_started_at = COALESCE(?, last_started_at) WHERE id = ?")
    .run(status, nowIso(), started ? nowIso() : null, id);
}

async function safePm2List() {
  try {
    const processes = await listProcesses();
    return new Map(processes.map((proc) => [proc.name, mapPm2Process(proc)]));
  } catch {
    return new Map();
  }
}

async function safeDescribe(pm2Name) {
  try {
    const proc = await describeProcess(pm2Name);
    return proc ? mapPm2Process(proc) : null;
  } catch {
    return null;
  }
}

function mapBot(row, pm2 = null) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug || slugify(row.name),
    description: row.description,
    projectPath: row.project_path,
    entrypoint: row.entrypoint,
    packageManager: row.package_manager,
    pm2Name: row.pm2_name,
    status: pm2?.status || row.status,
    enabled: Boolean(row.enabled),
    installStatus: row.install_status,
    serversCount: row.servers_count || 0,
    membersCount: row.members_count || 0,
    commandsCount: row.commands_count || 0,
    errorsCount: row.errors_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastStartedAt: row.last_started_at,
    pm2
  };
}

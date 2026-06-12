import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db, nowIso } from "../db/client.js";

const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts"]);
const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", ".turbo"]);

export async function analyzeCommands(projectRoot) {
  const files = await listSourceFiles(projectRoot);
  const commands = [];

  for (const filePath of files) {
    const source = await fs.readFile(filePath, "utf8").catch(() => "");
    const stat = await fs.stat(filePath).catch(() => null);
    commands.push(...detectSlashCommands(source, filePath, projectRoot, stat));
    commands.push(...detectPrefixCommands(source, filePath, projectRoot, stat));
  }

  const seen = new Set();
  return commands.filter((command) => {
    const key = `${command.type}:${command.name}:${command.sourceFile}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function listSourceFiles(root) {
  const results = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) await walk(path.join(dir, entry.name));
        continue;
      }

      if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        results.push(path.join(dir, entry.name));
      }
    }
  }

  await walk(root);
  return results.slice(0, 800);
}

function detectSlashCommands(source, filePath, projectRoot, stat) {
  const commands = [];
  const builderBlocks = source.match(/new\s+SlashCommandBuilder\(\)[\s\S]{0,2500}/g) || [];
  const directBlocks = source.match(/\.setName\(['"`][^'"`]+['"`]\)[\s\S]{0,1200}/g) || [];

  for (const block of [...builderBlocks, ...directBlocks]) {
    const name = readCallArgument(block, "setName");
    if (!name) continue;
    commands.push(buildCommand({
      type: "slash",
      name,
      description: readCallArgument(block, "setDescription") || "",
      permissions: readPermission(block),
      filePath,
      projectRoot,
      stat
    }));
  }

  return commands;
}

function detectPrefixCommands(source, filePath, projectRoot, stat) {
  const commands = [];
  const objectName = source.match(/\bname\s*:\s*['"`]([^'"`]+)['"`]/);
  const execute = /\bexecute\s*[:=]\s*(async\s*)?\(/.test(source) || /\brun\s*[:=]\s*(async\s*)?\(/.test(source);
  if (!objectName || !execute) return commands;

  commands.push(buildCommand({
    type: "prefix",
    name: objectName[1],
    description: readProperty(source, "description") || "",
    permissions: readProperty(source, "permissions") || readProperty(source, "permission") || "",
    filePath,
    projectRoot,
    stat
  }));
  return commands;
}

function readCallArgument(source, method) {
  const match = source.match(new RegExp(`\\.${method}\\(\\s*['"\`]([^'"\`]+)['"\`]\\s*\\)`));
  return match?.[1];
}

function readProperty(source, property) {
  const match = source.match(new RegExp(`\\b${property}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`));
  return match?.[1];
}

function readPermission(source) {
  const match = source.match(/PermissionFlagsBits\.([A-Za-z0-9_]+)/);
  return match?.[1] || "";
}

function buildCommand({ type, name, description, permissions, filePath, projectRoot, stat }) {
  const relative = path.relative(projectRoot, filePath).replaceAll("\\", "/");
  const parts = relative.split("/");
  const category = parts.length > 1 ? parts.at(-2) : "general";
  return {
    name,
    type,
    description,
    category,
    permissions,
    arguments: [],
    example: type === "slash" ? `/${name}` : `!${name}`,
    sourceFile: relative,
    sourceMtime: stat?.mtime?.toISOString() || null,
    enabled: true
  };
}

export function replaceBotCommands(botId, commands) {
  const now = nowIso();
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM commands WHERE bot_id = ?").run(botId);
    const insert = db.prepare(`
      INSERT INTO commands (
        id, bot_id, name, type, description, category, permissions,
        arguments_json, example, source_file, source_mtime, enabled, created_at, updated_at
      )
      VALUES (
        @id, @bot_id, @name, @type, @description, @category, @permissions,
        @arguments_json, @example, @source_file, @source_mtime, @enabled, @created_at, @updated_at
      )
    `);

    for (const command of commands) {
      insert.run({
        id: randomUUID(),
        bot_id: botId,
        name: command.name,
        type: command.type,
        description: command.description || "",
        category: command.category || "general",
        permissions: command.permissions || "",
        arguments_json: JSON.stringify(command.arguments || []),
        example: command.example || "",
        source_file: command.sourceFile || "",
        source_mtime: command.sourceMtime || "",
        enabled: command.enabled === false ? 0 : 1,
        created_at: now,
        updated_at: now
      });
    }

    db.prepare("UPDATE bots SET commands_count = ?, updated_at = ? WHERE id = ?").run(commands.length, now, botId);
  });

  transaction();
}

export function mapCommand(row) {
  return {
    id: row.id,
    botId: row.bot_id,
    name: row.name,
    type: row.type,
    description: row.description,
    category: row.category,
    permissions: row.permissions,
    arguments: JSON.parse(row.arguments_json || "[]"),
    example: row.example,
    sourceFile: row.source_file,
    sourceMtime: row.source_mtime,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

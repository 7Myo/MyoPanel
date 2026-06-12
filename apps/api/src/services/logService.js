import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { db, nowIso } from "../db/client.js";

export function addLog({ botId = null, source = "panel", level = "info", message, meta = {} }) {
  const row = {
    id: randomUUID(),
    bot_id: botId,
    source,
    level,
    message,
    meta_json: JSON.stringify(meta),
    created_at: nowIso()
  };
  db.prepare(`
    INSERT INTO logs (id, bot_id, source, level, message, meta_json, created_at)
    VALUES (@id, @bot_id, @source, @level, @message, @meta_json, @created_at)
  `).run(row);
  return row;
}

export function listLogs({ botId, level, source, search, limit = 200 } = {}) {
  const clauses = [];
  const params = {};

  if (botId) {
    clauses.push("bot_id = @botId");
    params.botId = botId;
  }
  if (level && level !== "all") {
    clauses.push("level = @level");
    params.level = level;
  }
  if (source && source !== "all") {
    clauses.push("source = @source");
    params.source = source;
  }
  if (search) {
    clauses.push("message LIKE @search");
    params.search = `%${search}%`;
  }

  params.limit = Math.min(Number(limit) || 200, 1000);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db.prepare(`
    SELECT *
    FROM logs
    ${where}
    ORDER BY created_at DESC
    LIMIT @limit
  `).all(params).map(mapLog);
}

export function purgeLogs({ botId } = {}) {
  if (botId) {
    return db.prepare("DELETE FROM logs WHERE bot_id = ?").run(botId).changes;
  }
  return db.prepare("DELETE FROM logs").run().changes;
}

export async function tailFile(filePath, maxBytes = 64_000) {
  const stat = await fs.stat(filePath);
  const start = Math.max(0, stat.size - maxBytes);
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(stat.size - start);
    await handle.read(buffer, 0, buffer.length, start);
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
}

export function mapLog(row) {
  return {
    id: row.id,
    botId: row.bot_id,
    source: row.source,
    level: row.level,
    message: row.message,
    meta: JSON.parse(row.meta_json || "{}"),
    createdAt: row.created_at
  };
}

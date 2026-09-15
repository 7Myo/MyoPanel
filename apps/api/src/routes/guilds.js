import { Router } from "express";
import { db, nowIso } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { requireBotAuth } from "../middleware/botAuth.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { randomUUID } from "node:crypto";

export const guildsRouter = Router();

guildsRouter.get("/", requireAuth, asyncHandler(async (_req, res) => {
  const guilds = db.prepare(`
    SELECT g.*, b.name AS bot_name, b.slug AS bot_slug, b.status AS bot_status
    FROM bot_guilds g
    JOIN bots b ON b.id = g.bot_id
    ORDER BY b.name, g.guild_name
  `).all();
  res.json({ guilds: guilds.map(mapGuild) });
}));

guildsRouter.get("/:botId", requireAuth, asyncHandler(async (req, res) => {
  const bot = getBot(req.params.botId);
  const guilds = db.prepare(`
    SELECT * FROM bot_guilds WHERE bot_id = ? ORDER BY guild_name
  `).all(bot.id);
  res.json({ bot: mapBotBrief(bot), guilds: guilds.map(mapGuild) });
}));

guildsRouter.put("/:botId", requireBotAuth, asyncHandler(async (req, res) => {
  const bot = req.bot;
  if (bot.id !== req.params.botId) {
    throw new HttpError(403, "Token non autorise pour ce bot.");
  }

  const guilds = req.body.guilds;
  if (!Array.isArray(guilds)) {
    throw new HttpError(400, "Le champ 'guilds' doit etre un tableau.");
  }

  const now = nowIso();
  let totalServers = 0;
  let totalMembers = 0;

  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM bot_guilds WHERE bot_id = ?").run(bot.id);

    const insert = db.prepare(`
      INSERT INTO bot_guilds (id, bot_id, guild_id, guild_name, member_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const seen = new Set();
    for (const guild of guilds) {
      const id = randomUUID();
      const name = String(guild.name || "").trim();
      const guildId = String(guild.id || "").trim();
      const memberCount = Number(guild.memberCount);
      if (!guildId || !name || !Number.isSafeInteger(memberCount) || memberCount < 0 || seen.has(guildId)) {
        throw new HttpError(400, "Donnees de serveur Discord invalides.");
      }
      seen.add(guildId);

      insert.run(id, bot.id, guildId, name, memberCount, now, now);
      totalServers++;
      totalMembers += memberCount;
    }

    db.prepare(`
      UPDATE bots SET servers_count = ?, members_count = ?, updated_at = ?
      WHERE id = ?
    `).run(totalServers, totalMembers, now, bot.id);
  });

  try {
    transaction();
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, "Erreur lors de la mise a jour des guilds: " + err.message);
  }

  res.json({ success: true, serversCount: totalServers, membersCount: totalMembers });
}));

function getBot(id) {
  const bot = db.prepare("SELECT * FROM bots WHERE id = ?").get(id);
  if (!bot) throw new HttpError(404, "Bot introuvable.");
  return bot;
}

function mapBotBrief(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    serversCount: row.servers_count || 0,
    membersCount: row.members_count || 0
  };
}

function mapGuild(row) {
  return {
    id: row.id,
    botId: row.bot_id,
    botName: row.bot_name,
    botSlug: row.bot_slug,
    botStatus: row.bot_status,
    guildId: row.guild_id,
    guildName: row.guild_name,
    memberCount: row.member_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

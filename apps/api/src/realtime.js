import { db } from "./db/client.js";
import { config } from "./config/env.js";
import { verifyToken } from "./middleware/auth.js";
import { isLanAddress } from "./middleware/lanOnly.js";
import { listLogs } from "./services/logService.js";
import { listProcesses, mapPm2Process } from "./services/pm2Service.js";
import { getSystemSnapshot } from "./services/systemService.js";

export function setupRealtime(io) {
  io.use((socket, next) => {
    if (config.lanOnly && !isLanAddress(socket.handshake.address || "")) {
      return next(new Error("Acces limite au reseau local."));
    }
    const token = socket.handshake.auth?.token;
    const auth = token ? verifyToken(token) : null;
    if (!auth) return next(new Error("Authentification requise."));
    socket.user = auth.user;
    next();
  });

  io.on("connection", (socket) => {
    let selectedBotId = null;

    const emitSystem = async () => {
      socket.emit("system:metrics", await getSystemSnapshot().catch((error) => ({ error: error.message })));
    };

    const emitBots = async () => {
      socket.emit("bots:status", await getBotsRealtime());
    };

    const emitBotLogs = () => {
      if (!selectedBotId) return;
      socket.emit("bot:logs", {
        botId: selectedBotId,
        logs: listLogs({ botId: selectedBotId, limit: 100 })
      });
    };

    socket.on("bot:subscribe", (botId) => {
      selectedBotId = botId;
      emitBotLogs();
    });

    socket.on("bot:unsubscribe", () => {
      selectedBotId = null;
    });

    emitSystem();
    emitBots();
    const systemTimer = setInterval(emitSystem, 5000);
    const botsTimer = setInterval(emitBots, 7000);
    const logsTimer = setInterval(emitBotLogs, 4000);

    socket.on("disconnect", () => {
      clearInterval(systemTimer);
      clearInterval(botsTimer);
      clearInterval(logsTimer);
    });
  });
}

async function getBotsRealtime() {
  const bots = db.prepare("SELECT * FROM bots ORDER BY created_at DESC").all();
  let pm2Map = new Map();
  try {
    const processes = await listProcesses();
    pm2Map = new Map(processes.map((proc) => [proc.name, mapPm2Process(proc)]));
  } catch {
    pm2Map = new Map();
  }

  return bots.map((bot) => ({
    id: bot.id,
    name: bot.name,
    status: pm2Map.get(bot.pm2_name)?.status || bot.status,
    pm2: pm2Map.get(bot.pm2_name) || null,
    commandsCount: bot.commands_count || 0,
    errorsCount: bot.errors_count || 0,
    serversCount: bot.servers_count || 0,
    membersCount: bot.members_count || 0,
    updatedAt: bot.updated_at
  }));
}

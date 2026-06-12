import { createRequire } from "node:module";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config, ensureRuntimeDirectories } from "./config/env.js";
import { initDatabase } from "./db/client.js";
import { lanOnly } from "./middleware/lanOnly.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";
import { setupRealtime } from "./realtime.js";
import { addLog } from "./services/logService.js";
import { getSystemSnapshot } from "./services/systemService.js";

const require = createRequire(import.meta.url);
const { Server } = require("socket.io");

ensureRuntimeDirectories();
initDatabase();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

app.set("trust proxy", ["loopback", "linklocal", "uniquelocal"]);
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({ origin: true, credentials: true }));
app.use(lanOnly);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", apiRouter);

const webDist = path.resolve(config.workspaceRoot, "apps/web/dist");
const webIndex = path.join(webDist, "index.html");
console.log(`[frontend] workspaceRoot = ${config.workspaceRoot}`);
console.log(`[frontend] webDist      = ${webDist}`);
console.log(`[frontend] dist exists  = ${fs.existsSync(webDist)}`);
console.log(`[frontend] index exists = ${fs.existsSync(webIndex)}`);
if (fs.existsSync(webDist) && fs.existsSync(webIndex)) {
  app.use(express.static(webDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) return next();
    res.sendFile(webIndex);
  });
  console.log(`[frontend] Servi depuis ${webDist}`);
} else {
  console.warn(`[frontend] Build introuvable dans ${webDist}. Lance "npm run build" pour generer le frontend.`);
  console.warn("[frontend] Les routes API (/api/*) restent accessibles.");
}

setupRealtime(io);

app.use(notFound);
app.use(errorHandler);

server.listen(config.port, config.host, () => {
  const message = `Myo's Panel ecoute sur http://${config.host}:${config.port} (LAN_ONLY=${config.lanOnly})`;
  console.log(message);
  addLog({ source: "panel", level: "info", message });
  getSystemSnapshot().then(() => console.log("[metrics] Cache systeme pre-charge.")).catch(() => null);
});

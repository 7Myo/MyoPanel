import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workspaceRoot = path.resolve(apiRoot, "../..");

dotenv.config({ path: process.env.ENV_FILE || path.resolve(workspaceRoot, ".env") });
dotenv.config({ path: process.env.ENV_FILE || path.resolve(apiRoot, ".env") });

const resolveRuntimePath = (value, fallback) => {
  const chosen = value || fallback;
  return path.isAbsolute(chosen) ? chosen : path.resolve(workspaceRoot, chosen);
};

const dataDir = resolveRuntimePath(process.env.DATA_DIR, "./runtime");

export const config = {
  apiRoot,
  workspaceRoot,
  nodeEnv: process.env.NODE_ENV || "development",
  host: process.env.HOST || "0.0.0.0",
  port: Number.parseInt(process.env.PORT || "3000", 10),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "http://localhost:3000",
  lanOnly: String(process.env.LAN_ONLY ?? "true").toLowerCase() !== "false",
  jwtSecret: process.env.JWT_SECRET || "dev-only-change-this-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  sessionTimeoutMinutes: Number.parseInt(process.env.SESSION_TIMEOUT_MINUTES || "480", 10),
  bcryptRounds: Number.parseInt(process.env.BCRYPT_ROUNDS || "12", 10),
  maxUploadMb: Number.parseInt(process.env.MAX_UPLOAD_MB || "250", 10),
  dataDir,
  dbPath: path.join(dataDir, "panel.db"),
  botsDir: resolveRuntimePath(process.env.BOTS_DIR, path.join(dataDir, "bots")),
  backupsDir: resolveRuntimePath(process.env.BACKUPS_DIR, path.join(dataDir, "backups")),
  logsDir: resolveRuntimePath(process.env.LOGS_DIR, path.join(dataDir, "logs")),
  tempDir: resolveRuntimePath(process.env.TEMP_DIR, path.join(dataDir, "tmp")),
  npmBin: process.env.NPM_BIN || "npm",
  pm2MaxMemory: process.env.PM2_MAX_MEMORY || "350M",
  adminUsername: process.env.ADMIN_USERNAME || process.env.ADMIN_EMAIL || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  adminName: process.env.ADMIN_NAME || ""
};

export function ensureRuntimeDirectories() {
  for (const dir of [config.dataDir, config.botsDir, config.backupsDir, config.logsDir, config.tempDir, path.join(config.tempDir, "uploads")]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (config.nodeEnv === "production" && config.jwtSecret === "dev-only-change-this-secret") {
    console.warn("[security] JWT_SECRET utilise la valeur de developpement. Definis une valeur forte dans .env.");
  }
}

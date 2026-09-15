import { createRequire } from "node:module";
import path from "node:path";
import { config } from "../config/env.js";

const require = createRequire(import.meta.url);

function loadPm2() {
  try {
    return require("pm2");
  } catch {
    return null;
  }
}

function withPm2(work) {
  const pm2 = loadPm2();
  if (!pm2) {
    return Promise.reject(new Error("PM2 n'est pas installe. Lance `npm install` puis installe PM2 sur Linux."));
  }

  return new Promise((resolve, reject) => {
    pm2.connect((connectError) => {
      if (connectError) return reject(connectError);
      work(pm2)
        .then(resolve, reject)
        .finally(() => pm2.disconnect());
    });
  });
}

function call(pm2, method, ...args) {
  return new Promise((resolve, reject) => {
    pm2[method](...args, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

export async function listProcesses() {
  return withPm2((pm2) => call(pm2, "list"));
}

export async function describeProcess(name) {
  const result = await withPm2((pm2) => call(pm2, "describe", name));
  return Array.isArray(result) ? result[0] : result;
}

export async function startBot(bot) {
  const projectPath = path.resolve(bot.project_path);
  const projectRelative = path.relative(config.botsDir, projectPath);
  const script = bot.entrypoint ? path.resolve(projectPath, bot.entrypoint) : undefined;
  const relative = script ? path.relative(projectPath, script) : "";
  if (!projectRelative || projectRelative.startsWith("..") || path.isAbsolute(projectRelative)
    || !script || !relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Point d'entree invalide pour ce bot.");
  }

  return withPm2((pm2) => call(pm2, "start", {
    name: bot.pm2_name,
    script,
    cwd: bot.project_path,
    max_memory_restart: config.pm2MaxMemory,
    env: {
      NODE_ENV: "production"
    }
  }));
}

export async function stopBot(bot) {
  return withPm2((pm2) => call(pm2, "stop", bot.pm2_name));
}

export async function restartBot(bot) {
  return withPm2((pm2) => call(pm2, "restart", bot.pm2_name));
}

export async function deleteBot(bot) {
  return withPm2((pm2) => call(pm2, "delete", bot.pm2_name));
}

export function mapPm2Process(proc) {
  const env = proc.pm2_env || {};
  return {
    name: proc.name,
    pmId: proc.pm_id,
    status: env.status || "unknown",
    restarts: env.restart_time || 0,
    uptime: env.pm_uptime ? Date.now() - env.pm_uptime : 0,
    cpu: proc.monit?.cpu || 0,
    memory: proc.monit?.memory || 0,
    outLogPath: env.pm_out_log_path,
    errorLogPath: env.pm_err_log_path
  };
}

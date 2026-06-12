import os from "node:os";
import si from "systeminformation";
import { randomUUID } from "node:crypto";
import { db, nowIso } from "../db/client.js";

const SNAPSHOT_TTL_MS = 10_000;
let snapshotCache = null;

export async function getSystemSnapshot() {
  const now = Date.now();
  if (snapshotCache && now - snapshotCache.timestamp < SNAPSHOT_TTL_MS) {
    return snapshotCache.data;
  }

  const [load, mem, fsSize, temp, network, processes] = await Promise.all([
    si.currentLoad().catch(() => null),
    si.mem().catch(() => null),
    si.fsSize().catch(() => []),
    si.cpuTemperature().catch(() => null),
    si.networkStats().catch(() => []),
    si.processes().catch(() => null)
  ]);

  const primaryDisk = Array.isArray(fsSize) ? fsSize.find((disk) => disk.mount === "/") || fsSize[0] : null;
  const networkTotals = Array.isArray(network)
    ? network.reduce((acc, iface) => ({
        rxSec: acc.rxSec + (iface.rx_sec || 0),
        txSec: acc.txSec + (iface.tx_sec || 0)
      }), { rxSec: 0, txSec: 0 })
    : { rxSec: 0, txSec: 0 };

  const snapshot = {
    createdAt: nowIso(),
    uptimeSeconds: os.uptime(),
    panelUptimeSeconds: process.uptime(),
    hostname: os.hostname(),
    platform: os.platform(),
    cpu: {
      load: round(load?.currentLoad || 0),
      cores: os.cpus().length,
      loadAverage: os.loadavg().map(round)
    },
    memory: {
      total: mem?.total || os.totalmem(),
      used: mem?.used || os.totalmem() - os.freemem(),
      free: mem?.free || os.freemem()
    },
    disk: {
      total: primaryDisk?.size || 0,
      used: primaryDisk?.used || 0,
      available: primaryDisk?.available || 0,
      use: round(primaryDisk?.use || 0)
    },
    temperature: {
      main: temp?.main || null
    },
    network: networkTotals,
    processes: {
      all: processes?.all || 0,
      running: processes?.running || 0
    }
  };

  saveMetric("system", null, snapshot);

  snapshotCache = { data: snapshot, timestamp: now };
  return snapshot;
}

export function saveMetric(scope, botId, payload) {
  db.prepare(`
    INSERT INTO metrics (id, scope, bot_id, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), scope, botId, JSON.stringify(payload), nowIso());
}

export function getMetricHistory(scope = "system", limit = 288) {
  return db.prepare(`
    SELECT *
    FROM metrics
    WHERE scope = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(scope, limit).reverse().map((row) => ({
    id: row.id,
    scope: row.scope,
    botId: row.bot_id,
    payload: JSON.parse(row.payload_json || "{}"),
    createdAt: row.created_at
  }));
}

function round(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config/env.js";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'moderator', 'readonly')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_id TEXT NOT NULL UNIQUE,
      ip TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      project_path TEXT NOT NULL,
      entrypoint TEXT,
      package_manager TEXT DEFAULT 'npm',
      pm2_name TEXT NOT NULL UNIQUE,
      bot_token TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      enabled INTEGER NOT NULL DEFAULT 1,
      install_status TEXT NOT NULL DEFAULT 'pending',
      servers_count INTEGER DEFAULT 0,
      members_count INTEGER DEFAULT 0,
      commands_count INTEGER DEFAULT 0,
      errors_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_started_at TEXT
    );

    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      safe_name TEXT NOT NULL,
      archive_path TEXT NOT NULL,
      extract_path TEXT NOT NULL,
      detected_root TEXT,
      analysis_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      confirmed_at TEXT,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS commands (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      category TEXT,
      permissions TEXT,
      arguments_json TEXT DEFAULT '[]',
      example TEXT,
      source_file TEXT,
      source_mtime TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      bot_id TEXT REFERENCES bots(id) ON DELETE SET NULL,
      source TEXT NOT NULL,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      meta_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      bot_id TEXT REFERENCES bots(id) ON DELETE CASCADE,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      format TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      meta_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bot_guilds (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
      guild_id TEXT NOT NULL,
      guild_name TEXT NOT NULL,
      member_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(bot_id, guild_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  migrateEmailToUsername();
  migrateBotGuilds();
  seedAdminUser();
}

function migrateEmailToUsername() {
  try {
    db.exec("ALTER TABLE users RENAME COLUMN email TO username");
  } catch {
  }
}

function migrateBotGuilds() {
  try {
    db.exec("ALTER TABLE bots ADD COLUMN bot_token TEXT UNIQUE");
  } catch {
  }

  try {
    const botsWithoutToken = db.prepare("SELECT id FROM bots WHERE bot_token IS NULL").all();
    const updateStmt = db.prepare("UPDATE bots SET bot_token = ? WHERE id = ?");
    for (const bot of botsWithoutToken) {
      updateStmt.run(randomUUID() + randomUUID(), bot.id);
    }
  } catch {
  }
}

function seedAdminUser() {
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (userCount > 0) return;
  if (!config.adminPassword) return;

  const now = new Date().toISOString();
  const username = config.adminUsername || config.adminEmail || "admin";
  const name = config.adminName || "Administrateur";
  const passwordHash = bcrypt.hashSync(config.adminPassword, config.bcryptRounds);
  db.prepare(`
    INSERT INTO users (id, username, name, password_hash, role, active, created_at, updated_at)
    VALUES (@id, @username, @name, @password_hash, 'admin', 1, @created_at, @updated_at)
  `).run({
    id: randomUUID(),
    username: username.toLowerCase(),
    name,
    password_hash: passwordHash,
    created_at: now,
    updated_at: now
  });
}

export function nowIso() {
  return new Date().toISOString();
}

export function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at
  };
}

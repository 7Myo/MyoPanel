import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { config } from "../config/env.js";
import { db, nowIso, mapUser } from "../db/client.js";
import { hashPassword, createSession } from "../middleware/auth.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../utils/http.js";

export const settingsRouter = Router();

const wallpaperUpload = multer({
  dest: path.join(config.tempDir, "wallpapers"),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) cb(new HttpError(400, "Format d'image non supporte."));
    else cb(null, true);
  }
});

function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row?.value || null;
}

function setSetting(key, value) {
  const now = nowIso();
  db.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`).run(key, value, now);
}

function deleteSetting(key) {
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}

settingsRouter.get("/", requireAuth, (_req, res) => {
  res.json({
    darkMode: getSetting("darkMode") || "false",
    wallpaper: getSetting("wallpaper") || null
  });
});

settingsRouter.put("/dark-mode", requireAuth, (req, res) => {
  const value = String(req.body.darkMode === true || req.body.darkMode === "true" ? "true" : "false");
  setSetting("darkMode", value);
  res.json({ darkMode: value });
});

settingsRouter.post("/wallpaper", requireAuth, wallpaperUpload.single("wallpaper"), async (req, res) => {
  if (!req.file) throw new HttpError(400, "Image requise.");
  const image = await fs.readFile(req.file.path);
  const base64 = `data:${req.file.mimetype};base64,${image.toString("base64")}`;
  setSetting("wallpaper", base64);
  await fs.unlink(req.file.path).catch(() => null);
  res.json({ wallpaper: base64 });
});

settingsRouter.delete("/wallpaper", requireAuth, (_req, res) => {
  deleteSetting("wallpaper");
  res.status(204).end();
});

settingsRouter.get("/setup-status", (_req, res) => {
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  res.json({ needsSetup: userCount === 0 });
});

const DEFAULT_ROLE_PERMISSIONS = {
  moderator: {
    canManageUsers: false,
    canManageBots: true
  },
  readonly: {
    canViewLogs: true,
    canViewStorage: true
  }
};

settingsRouter.get("/role-permissions", requireAdmin, (_req, res) => {
  const stored = getSetting("rolePermissions");
  const permissions = stored ? JSON.parse(stored) : DEFAULT_ROLE_PERMISSIONS;
  res.json({ permissions });
});

settingsRouter.put("/role-permissions", requireAdmin, asyncHandler(async (req, res) => {
  const permissions = req.body.permissions;
  if (!permissions || typeof permissions !== "object") throw new HttpError(400, "Permissions invalides.");

  const merged = {
    moderator: { ...DEFAULT_ROLE_PERMISSIONS.moderator, ...(permissions.moderator || {}) },
    readonly: { ...DEFAULT_ROLE_PERMISSIONS.readonly, ...(permissions.readonly || {}) }
  };

  setSetting("rolePermissions", JSON.stringify(merged));
  res.json({ permissions: merged });
}));

settingsRouter.post("/setup", asyncHandler(async (req, res) => {
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (userCount > 0) throw new HttpError(409, "Un compte administrateur existe deja.");

  const username = String(req.body.username || "").trim().toLowerCase();
  const name = String(req.body.name || "").trim();
  const password = String(req.body.password || "");
  const confirmPassword = String(req.body.confirmPassword || "");

  if (!username || !name || !password) throw new HttpError(400, "Nom d'utilisateur, nom et mot de passe requis.");
  if (password.length < 8) throw new HttpError(400, "Le mot de passe doit contenir au moins 8 caracteres.");
  if (password !== confirmPassword) throw new HttpError(400, "Les mots de passe ne correspondent pas.");

  const now = nowIso();
  const id = randomUUID();
  const passwordHash = hashPassword(password);

  db.prepare(`
    INSERT INTO users (id, username, name, password_hash, role, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'admin', 1, ?, ?)
  `).run(id, username, name, passwordHash, now, now);

  const user = mapUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
  const { token } = createSession(user, req);

  res.status(201).json({ success: true, token, user });
}));

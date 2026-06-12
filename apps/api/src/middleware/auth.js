import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { config } from "../config/env.js";
import { db, mapUser, nowIso } from "../db/client.js";
import { HttpError } from "../utils/http.js";

export function hashPassword(password) {
  return bcrypt.hashSync(password, config.bcryptRounds);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function createSession(user, req) {
  const sessionId = randomUUID();
  const tokenId = randomUUID();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + config.sessionTimeoutMinutes * 60_000).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, token_id, ip, user_agent, expires_at, created_at)
    VALUES (@id, @user_id, @token_id, @ip, @user_agent, @expires_at, @created_at)
  `).run({
    id: sessionId,
    user_id: user.id,
    token_id: tokenId,
    ip: req.ip,
    user_agent: req.get("user-agent") || "",
    expires_at: expiresAt,
    created_at: createdAt
  });

  const token = jwt.sign(
    { sub: user.id, sid: sessionId, role: user.role },
    config.jwtSecret,
    { jwtid: tokenId, expiresIn: config.jwtExpiresIn }
  );

  return { token, expiresAt };
}

export function readToken(req) {
  const header = req.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const session = db.prepare(`
      SELECT s.*, u.username, u.name, u.role, u.active, u.created_at, u.updated_at, u.last_login_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.token_id = ?
    `).get(payload.sid, payload.jti);

    if (!session || session.revoked_at || new Date(session.expires_at).getTime() < Date.now()) {
      return null;
    }
    if (!session.active) return null;

    return {
      session,
      user: mapUser({
        id: session.user_id,
        username: session.username,
        name: session.name,
        role: session.role,
        active: session.active,
        created_at: session.created_at,
        updated_at: session.updated_at,
        last_login_at: session.last_login_at
      })
    };
  } catch {
    return null;
  }
}

export function requireAuth(req, _res, next) {
  const auth = verifyToken(readToken(req));
  if (!auth) return next(new HttpError(401, "Authentification requise."));
  const nextExpiry = new Date(Date.now() + config.sessionTimeoutMinutes * 60_000).toISOString();
  db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(nextExpiry, auth.session.id);
  auth.session.expires_at = nextExpiry;
  req.user = auth.user;
  req.session = auth.session;
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, "Permission insuffisante."));
    }
    next();
  };
}

export function requireWriteAccess(req, res, next) {
  return requireRole("admin", "moderator")(req, res, next);
}

export function requireAdmin(req, res, next) {
  return requireRole("admin")(req, res, next);
}

function getRolePermissions() {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("rolePermissions");
    return row ? JSON.parse(row.value) : null;
  } catch { return null; }
}

const DEFAULT_PERMISSIONS = {
  moderator: { canManageUsers: false, canManageBots: true },
  readonly: { canViewLogs: true, canViewStorage: true }
};

export function canManageUsers(req, _res, next) {
  if (!req.user) return next(new HttpError(401, "Authentification requise."));
  if (req.user.role === "admin") return next();

  const perms = getRolePermissions() || DEFAULT_PERMISSIONS;
  if (req.user.role === "moderator" && perms.moderator?.canManageUsers) return next();

  return next(new HttpError(403, "Permission insuffisante."));
}

export function canManageBots(req, _res, next) {
  if (!req.user) return next(new HttpError(401, "Authentification requise."));
  if (req.user.role === "admin") return next();

  const perms = getRolePermissions() || DEFAULT_PERMISSIONS;
  if (req.user.role === "moderator" && perms.moderator?.canManageBots !== false) return next();

  return next(new HttpError(403, "Permission insuffisante."));
}

export function canViewLogs(req, _res, next) {
  if (!req.user) return next(new HttpError(401, "Authentification requise."));
  if (req.user.role === "admin" || req.user.role === "moderator") return next();

  const perms = getRolePermissions() || DEFAULT_PERMISSIONS;
  if (req.user.role === "readonly" && perms.readonly?.canViewLogs !== false) return next();

  return next(new HttpError(403, "Permission insuffisante."));
}

export function canViewStorage(req, _res, next) {
  if (!req.user) return next(new HttpError(401, "Authentification requise."));
  if (req.user.role === "admin" || req.user.role === "moderator") return next();

  const perms = getRolePermissions() || DEFAULT_PERMISSIONS;
  if (req.user.role === "readonly" && perms.readonly?.canViewStorage !== false) return next();

  return next(new HttpError(403, "Permission insuffisante."));
}

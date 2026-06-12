import { Router } from "express";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { db, mapUser, nowIso } from "../db/client.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { createSession, readToken, requireAuth, verifyPassword } from "../middleware/auth.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Trop de tentatives. Reessaie dans quelques minutes." } }
});

authRouter.post("/login", loginLimiter, asyncHandler(async (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!username || !password) throw new HttpError(400, "Nom d'utilisateur et mot de passe requis.");

  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!row || !row.active || !verifyPassword(password, row.password_hash)) {
    audit({ userId: row?.id, action: "login_failed", req, meta: { username } });
    throw new HttpError(401, "Identifiants invalides.");
  }

  const user = mapUser(row);
  const session = createSession(user, req);
  db.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(nowIso(), nowIso(), user.id);
  audit({ userId: user.id, action: "login_success", req });

  res.json({ user: { ...user, lastLoginAt: nowIso() }, token: session.token, expiresAt: session.expiresAt });
}));

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

authRouter.post("/logout", requireAuth, (req, res) => {
  db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?").run(nowIso(), req.session.id);
  audit({ userId: req.user.id, action: "logout", req });
  res.status(204).end();
});

authRouter.post("/refresh", requireAuth, (req, res) => {
  db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?").run(nowIso(), req.session.id);
  const nextSession = createSession(req.user, req);
  audit({ userId: req.user.id, action: "session_refresh", req });
  res.json({ user: req.user, token: nextSession.token, expiresAt: nextSession.expiresAt });
});

export function audit({ userId = null, action, req, meta = {} }) {
  db.prepare(`
    INSERT INTO audit_events (id, user_id, action, ip, user_agent, meta_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    userId,
    action,
    req.ip,
    req.get("user-agent") || "",
    JSON.stringify({ ...meta, hasToken: Boolean(readToken(req)) }),
    nowIso()
  );
}

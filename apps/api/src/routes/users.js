import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db, mapUser, nowIso } from "../db/client.js";
import { hashPassword, requireAuth, canManageUsers } from "../middleware/auth.js";
import { asyncHandler, HttpError, sendCreated } from "../utils/http.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/", canManageUsers, (_req, res) => {
  const users = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all().map(mapUser);
  res.json({ users });
});

usersRouter.post("/", canManageUsers, asyncHandler(async (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const name = String(req.body.name || "").trim();
  const password = String(req.body.password || "");
  const role = String(req.body.role || "readonly");

  if (!username || !name || !password) throw new HttpError(400, "Nom d'utilisateur, nom et mot de passe requis.");
  if (!["admin", "moderator", "readonly"].includes(role)) throw new HttpError(400, "Role invalide.");
  if (req.user.role !== "admin" && role === "admin") throw new HttpError(403, "Seul un administrateur peut creer un compte admin.");

  const now = nowIso();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO users (id, username, name, password_hash, role, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, username, name, hashPassword(password), role, now, now);

  sendCreated(res, { user: mapUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id)) });
}));

usersRouter.patch("/:id", canManageUsers, asyncHandler(async (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) throw new HttpError(404, "Utilisateur introuvable.");

  const next = {
    name: req.body.name ?? user.name,
    role: req.body.role ?? user.role,
    active: req.body.active === undefined ? user.active : (req.body.active ? 1 : 0),
    updated_at: nowIso(),
    id: user.id
  };

  if (!["admin", "moderator", "readonly"].includes(next.role)) throw new HttpError(400, "Role invalide.");
  if (req.user.role !== "admin" && next.role === "admin") throw new HttpError(403, "Seul un administrateur peut attribuer le role admin.");
  if (req.user.role !== "admin" && user.role === "admin" && next.role !== "admin") throw new HttpError(403, "Impossible de retrograder un administrateur.");
  db.prepare("UPDATE users SET name = @name, role = @role, active = @active, updated_at = @updated_at WHERE id = @id").run(next);

  if (req.body.password) {
    db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
      .run(hashPassword(String(req.body.password)), nowIso(), user.id);
  }

  res.json({ user: mapUser(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id)) });
}));

usersRouter.delete("/:id", canManageUsers, asyncHandler(async (req, res, next) => {
  if (req.params.id === req.user.id) return next(new HttpError(400, "Impossible de supprimer son propre compte."));
  const target = db.prepare("SELECT role FROM users WHERE id = ?").get(req.params.id);
  if (!target) return next(new HttpError(404, "Utilisateur introuvable."));
  if (req.user.role !== "admin" && target.role === "admin") return next(new HttpError(403, "Impossible de supprimer un administrateur."));
  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  res.status(204).end();
}));

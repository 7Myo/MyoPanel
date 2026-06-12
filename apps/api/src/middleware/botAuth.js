import { db } from "../db/client.js";
import { HttpError } from "../utils/http.js";

export function requireBotAuth(req, _res, next) {
  const header = req.get("authorization") || "";
  if (!header.startsWith("Bearer ")) {
    return next(new HttpError(401, "Token bot requis."));
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) return next(new HttpError(401, "Token bot requis."));

  const bot = db.prepare("SELECT * FROM bots WHERE bot_token = ?").get(token);
  if (!bot) return next(new HttpError(401, "Token bot invalide."));

  req.bot = bot;
  next();
}

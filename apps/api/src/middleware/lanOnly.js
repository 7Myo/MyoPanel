import net from "node:net";
import { config } from "../config/env.js";
import { HttpError } from "../utils/http.js";

function normalizeAddress(value = "") {
  let ip = value.split(",")[0].trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice("::ffff:".length);
  return ip;
}

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}

export function isLanAddress(ip) {
  const normalized = normalizeAddress(ip);
  const family = net.isIP(normalized);
  if (family === 4) return isPrivateIPv4(normalized);
  if (family === 6) return isPrivateIPv6(normalized);
  return false;
}

export function lanOnly(req, _res, next) {
  if (!config.lanOnly) return next();
  const ip = normalizeAddress(req.ip || req.socket.remoteAddress || "");
  if (isLanAddress(ip)) return next();
  next(new HttpError(403, "Acces limite au reseau local."));
}

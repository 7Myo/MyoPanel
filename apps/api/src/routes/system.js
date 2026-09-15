import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";
import { getMetricHistory, getSystemSnapshot } from "../services/systemService.js";

export const systemRouter = Router();

systemRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "myos-panel-api" });
});

systemRouter.use(requireAuth);

systemRouter.get("/metrics", asyncHandler(async (_req, res) => {
  res.json({ metrics: await getSystemSnapshot() });
}));

systemRouter.get("/history", (req, res) => {
  const requested = Number(req.query.limit || 288);
  if (!Number.isInteger(requested) || requested < 1) return res.status(400).json({ error: { message: "Limit invalide." } });
  res.json({ history: getMetricHistory("system", Math.min(requested, 1000)) });
});

import { Router } from "express";
import { requireAuth, requireWriteAccess, canViewLogs } from "../middleware/auth.js";
import { listLogs, purgeLogs } from "../services/logService.js";

export const logsRouter = Router();

logsRouter.use(requireAuth);

logsRouter.get("/", canViewLogs, (req, res) => {
  const logs = listLogs({
    botId: req.query.botId,
    level: req.query.level,
    source: req.query.source,
    search: req.query.search,
    limit: req.query.limit
  });
  res.json({ logs });
});

logsRouter.get("/export", canViewLogs, (req, res) => {
  const logs = listLogs({ botId: req.query.botId, level: req.query.level, source: req.query.source, search: req.query.search, limit: 1000 });
  const body = logs.reverse().map((log) => `[${log.createdAt}] ${log.level.toUpperCase()} ${log.source}: ${log.message}`).join("\n");
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.setHeader("content-disposition", "attachment; filename=\"myos-panel-logs.txt\"");
  res.send(body);
});

logsRouter.delete("/", requireWriteAccess, (req, res) => {
  const deleted = purgeLogs({ botId: req.query.botId });
  res.json({ deleted });
});

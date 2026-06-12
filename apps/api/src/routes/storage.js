import { Router } from "express";
import { requireAuth, canViewStorage } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";
import { getStorageSummary } from "../services/storageService.js";

export const storageRouter = Router();

storageRouter.use(requireAuth);

storageRouter.get("/", canViewStorage, asyncHandler(async (_req, res) => {
  res.json({ storage: await getStorageSummary() });
}));

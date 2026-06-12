import { Router } from "express";
import { authRouter } from "./auth.js";
import { usersRouter } from "./users.js";
import { botsRouter } from "./bots.js";
import { importsRouter } from "./imports.js";
import { logsRouter } from "./logs.js";
import { systemRouter } from "./system.js";
import { storageRouter } from "./storage.js";
import { backupsRouter } from "./backups.js";
import { settingsRouter } from "./settings.js";
import { guildsRouter } from "./guilds.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/bots", botsRouter);
apiRouter.use("/imports", importsRouter);
apiRouter.use("/logs", logsRouter);
apiRouter.use("/system", systemRouter);
apiRouter.use("/storage", storageRouter);
apiRouter.use("/backups", backupsRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/guilds", guildsRouter);

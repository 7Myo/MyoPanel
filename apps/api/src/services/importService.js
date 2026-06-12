import fs from "fs-extra";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import unzipper from "unzipper";
import { config } from "../config/env.js";
import { db, nowIso } from "../db/client.js";
import { analyzeCommands, replaceBotCommands } from "./commandAnalyzer.js";
import { addLog } from "./logService.js";
import { startBot } from "./pm2Service.js";
import { slugify, uniqueSlug } from "../utils/slug.js";
import { HttpError } from "../utils/http.js";

export async function analyzeUploadedZip({ file, userId }) {
  const id = randomUUID();
  const importDir = path.join(config.tempDir, "imports", id);
  const extractPath = path.join(importDir, "extracted");
  await fs.ensureDir(extractPath);

  const archivePath = path.join(importDir, file.originalname);
  await fs.move(file.path, archivePath, { overwrite: true });
  await extractZip(archivePath, extractPath);

  const analysis = await analyzeProject(extractPath);
  const now = nowIso();

  db.prepare(`
    INSERT INTO imports (
      id, original_name, safe_name, archive_path, extract_path, detected_root,
      analysis_json, status, created_by, created_at
    )
    VALUES (@id, @original_name, @safe_name, @archive_path, @extract_path, @detected_root,
      @analysis_json, 'analyzed', @created_by, @created_at)
  `).run({
    id,
    original_name: file.originalname,
    safe_name: slugify(path.basename(file.originalname, path.extname(file.originalname))),
    archive_path: archivePath,
    extract_path: extractPath,
    detected_root: analysis.projectRoot,
    analysis_json: JSON.stringify(analysis),
    created_by: userId,
    created_at: now
  });

  addLog({ source: "import", level: "info", message: `ZIP analyse: ${file.originalname}`, meta: { importId: id } });
  return { id, analysis, status: "analyzed", createdAt: now };
}

export async function confirmImport(importId, options = {}) {
  const row = db.prepare("SELECT * FROM imports WHERE id = ?").get(importId);
  if (!row) throw new HttpError(404, "Import introuvable.");
  if (row.status !== "analyzed") throw new HttpError(409, "Cet import n'est pas pret a etre valide.");

  const analysis = JSON.parse(row.analysis_json);
  if (!analysis.packageJson?.exists) throw new HttpError(400, "Aucun package.json detecte.");
  if (!analysis.entrypoint) throw new HttpError(400, "Point d'entree introuvable.");

  const baseName = options.name || analysis.packageJson.name || row.safe_name;
  const slug = uniqueSlug(baseName, (candidate) => {
    const existing = db.prepare("SELECT id FROM bots WHERE slug = ?").get(candidate);
    return Boolean(existing) || fs.existsSync(path.join(config.botsDir, candidate));
  });

  const targetPath = path.join(config.botsDir, slug);
  await fs.ensureDir(config.botsDir);
  await fs.move(analysis.projectRoot, targetPath, { overwrite: false });

  const botId = randomUUID();
  const pm2Name = `myos-${slug}`;
  const now = nowIso();

  db.prepare(`
    INSERT INTO bots (
      id, name, slug, description, project_path, entrypoint, package_manager,
      pm2_name, status, enabled, install_status, commands_count, created_at, updated_at
    )
    VALUES (
      @id, @name, @slug, @description, @project_path, @entrypoint, @package_manager,
      @pm2_name, 'installing', 1, 'installing', @commands_count, @created_at, @updated_at
    )
  `).run({
    id: botId,
    name: baseName,
    slug,
    description: options.description || analysis.packageJson.description || "",
    project_path: targetPath,
    entrypoint: analysis.entrypoint,
    package_manager: analysis.packageManager,
    pm2_name: pm2Name,
    commands_count: analysis.commands.length,
    created_at: now,
    updated_at: now
  });

  replaceBotCommands(botId, analysis.commands);

  try {
    if (options.installDependencies !== false) {
      await runCommand(config.npmBin, ["install", "--omit=dev"], { cwd: targetPath, timeoutMs: 15 * 60_000 });
    }

    let status = "stopped";
    if (options.startNow !== false) {
      const bot = db.prepare("SELECT * FROM bots WHERE id = ?").get(botId);
      await startBot(bot);
      status = "online";
    }

    db.prepare("UPDATE bots SET status = ?, install_status = 'ready', updated_at = ?, last_started_at = ? WHERE id = ?")
      .run(status, nowIso(), status === "online" ? nowIso() : null, botId);
    db.prepare("UPDATE imports SET status = 'confirmed', confirmed_at = ? WHERE id = ?").run(nowIso(), importId);
    addLog({ botId, source: "import", level: "info", message: `Bot importe et ${status === "online" ? "demarre" : "prepare"}: ${baseName}` });
  } catch (error) {
    db.prepare("UPDATE bots SET status = 'errored', install_status = 'failed', updated_at = ? WHERE id = ?")
      .run(nowIso(), botId);
    db.prepare("UPDATE imports SET status = 'failed', error = ? WHERE id = ?").run(error.message, importId);
    addLog({ botId, source: "import", level: "error", message: `Import echoue: ${error.message}` });
    throw error;
  }

  return db.prepare("SELECT * FROM bots WHERE id = ?").get(botId);
}

export async function analyzeProject(extractPath) {
  const projectRoot = await detectProjectRoot(extractPath);
  const packagePath = path.join(projectRoot, "package.json");
  const packageJson = await readJson(packagePath);
  const entrypoint = await detectEntrypoint(projectRoot, packageJson);
  const envFiles = await detectEnvFiles(projectRoot);
  const commands = await analyzeCommands(projectRoot);

  return {
    projectRoot,
    packageJson: {
      exists: Boolean(packageJson),
      name: packageJson?.name || "",
      version: packageJson?.version || "",
      description: packageJson?.description || "",
      scripts: packageJson?.scripts || {},
      dependencies: Object.keys(packageJson?.dependencies || {}),
      devDependencies: Object.keys(packageJson?.devDependencies || {})
    },
    packageManager: await detectPackageManager(projectRoot),
    entrypoint,
    envFiles,
    commands,
    warnings: buildWarnings({ packageJson, entrypoint, envFiles })
  };
}

async function extractZip(zipPath, targetDir) {
  const directory = await unzipper.Open.file(zipPath);
  const targetRoot = path.resolve(targetDir);

  for (const entry of directory.files) {
    const destination = path.resolve(targetRoot, entry.path);
    if (!destination.startsWith(`${targetRoot}${path.sep}`) && destination !== targetRoot) {
      throw new HttpError(400, "Archive ZIP invalide: chemin dangereux detecte.");
    }

    if (entry.type === "Directory") {
      await fs.ensureDir(destination);
    } else {
      await fs.ensureDir(path.dirname(destination));
      await pipeline(entry.stream(), fs.createWriteStream(destination));
    }
  }
}

async function detectProjectRoot(extractPath) {
  const directPackage = path.join(extractPath, "package.json");
  if (await fs.pathExists(directPackage)) return extractPath;

  const entries = await fs.readdir(extractPath, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());
  for (const dir of directories) {
    const candidate = path.join(extractPath, dir.name);
    if (await fs.pathExists(path.join(candidate, "package.json"))) return candidate;
  }

  return extractPath;
}

async function readJson(filePath) {
  try {
    return await fs.readJson(filePath);
  } catch {
    return null;
  }
}

async function detectEntrypoint(projectRoot, packageJson) {
  const candidates = [
    packageJson?.main,
    parseStartScript(packageJson?.scripts?.start),
    "index.js",
    "main.js",
    "bot.js",
    "src/index.js"
  ].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = candidate.replace(/^node\s+/, "").replace(/^\.?[/\\]/, "");
    if (await fs.pathExists(path.join(projectRoot, normalized))) return normalized;
  }

  return null;
}

function parseStartScript(script = "") {
  const match = script.match(/(?:node|tsx|ts-node)\s+([^\s]+)/);
  return match?.[1];
}

async function detectPackageManager(projectRoot) {
  if (await fs.pathExists(path.join(projectRoot, "package-lock.json"))) return "npm";
  if (await fs.pathExists(path.join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (await fs.pathExists(path.join(projectRoot, "yarn.lock"))) return "yarn";
  return "npm";
}

async function detectEnvFiles(projectRoot) {
  const files = [];
  for (const fileName of [".env", ".env.example"]) {
    const filePath = path.join(projectRoot, fileName);
    if (!await fs.pathExists(filePath)) continue;
    const content = await fs.readFile(filePath, "utf8");
    files.push({
      name: fileName,
      keys: content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => line.split("=")[0].trim())
    });
  }
  return files;
}

function buildWarnings({ packageJson, entrypoint, envFiles }) {
  const warnings = [];
  if (!packageJson) warnings.push("Aucun package.json detecte.");
  if (!entrypoint) warnings.push("Aucun point d'entree standard detecte.");
  if (envFiles.some((file) => file.name === ".env")) {
    warnings.push("Un fichier .env est present dans le ZIP. Verifie les secrets avant demarrage.");
  }
  return warnings;
}

function runCommand(command, args, { cwd, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: process.platform === "win32" });
    let output = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} a depasse le temps limite.`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      output = output.slice(-20_000);
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
      output = output.slice(-20_000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error(`${command} ${args.join(" ")} a echoue avec le code ${code}: ${output}`));
    });
  });
}

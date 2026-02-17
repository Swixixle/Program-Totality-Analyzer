import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import { existsSync, readFileSync, appendFileSync, mkdirSync } from "fs";
import crypto from "crypto";
import { processOneJob, startWorkerLoop, getDiskStatus } from "./ci-worker";

const LOG_DIR = path.resolve(process.cwd(), "out", "_log");
const LOG_FILE = path.join(LOG_DIR, "analyzer.ndjson");

function logEvent(projectId: number, event: string, detail?: Record<string, unknown>) {
  mkdirSync(LOG_DIR, { recursive: true });
  const entry = {
    ts: new Date().toISOString(),
    projectId,
    event,
    ...detail,
  };
  appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
}

function logAdminEvent(event: string, detail?: Record<string, unknown>) {
  logEvent(0, event, detail);
}

function requireDevAdmin(req: any, res: any): boolean {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  const required = process.env.ADMIN_KEY;
  if (required && required.length > 0) {
    const provided = String(req.headers["x-admin-key"] || "");
    if (provided !== required) {
      res.status(401).json({ error: "Unauthorized" });
      return false;
    }
  } else {
    logAdminEvent("admin_unguarded", {
      path: req.path,
      ip: req.ip,
      ua: String(req.headers["user-agent"] || ""),
    });
  }
  return true;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/health", async (_req, res) => {
    const dbOk = await storage.getProjects().then(() => true).catch(() => false);
    res.json({ ok: true, db: dbOk, uptime: process.uptime() });
  });

  // Enhanced health endpoint with comprehensive checks
  app.get("/api/health", async (_req: Request, res: Response) => {
    const checks: Record<string, any> = {
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      node_env: process.env.NODE_ENV || "development",
    };

    // Version info
    try {
      const pkg = require("../package.json");
      checks.version = pkg.version || "unknown";
    } catch {
      checks.version = "unknown";
    }

    // Database check
    try {
      await storage.getProjects();
      checks.database = { status: "ok", message: "Database connection successful" };
    } catch (err: any) {
      checks.database = { status: "error", message: err.message || "Database connection failed" };
    }

    // Analyzer check (verify Python analyzer is accessible)
    try {
      const analyzerPath = path.join(process.cwd(), "server", "analyzer", "analyzer_cli.py");
      const analyzerExists = existsSync(analyzerPath);
      checks.analyzer = {
        status: analyzerExists ? "ok" : "error",
        path: analyzerPath,
        exists: analyzerExists,
      };
    } catch (err: any) {
      checks.analyzer = { status: "error", message: err.message || "Analyzer check failed" };
    }

    // Worker check (CI job processing)
    try {
      const jobCounts = await storage.getCiJobCounts();
      const lastRun = await storage.getLastCompletedRun();
      checks.worker = {
        status: "ok",
        jobs: jobCounts,
        last_completed: lastRun
          ? {
              id: lastRun.id,
              finished_at: lastRun.finishedAt,
              repo: `${lastRun.repoOwner}/${lastRun.repoName}`,
            }
          : null,
      };
    } catch (err: any) {
      checks.worker = { status: "error", message: err.message || "Worker check failed" };
    }

    // Disk check
    try {
      const disk = getDiskStatus();
      checks.disk = {
        status: disk.ciTmpDirLowDisk ? "warning" : "ok",
        ci_tmp_dir: disk.ciTmpDir,
        free_bytes: disk.ciTmpDirFreeBytes,
        low_disk: disk.ciTmpDirLowDisk,
      };
    } catch (err: any) {
      checks.disk = { status: "error", message: err.message || "Disk check failed" };
    }

    // Overall status
    const hasErrors = Object.values(checks).some(
      (check) => typeof check === "object" && check.status === "error"
    );
    const hasWarnings = Object.values(checks).some(
      (check) => typeof check === "object" && check.status === "warning"
    );

    const overallStatus = hasErrors ? "unhealthy" : hasWarnings ? "degraded" : "healthy";

    res.status(hasErrors ? 503 : 200).json({
      status: overallStatus,
      checks,
    });
  });

  app.get(api.projects.list.path, async (_req, res) => {
    const projects = await storage.getProjects();
    res.json(projects);
  });

  app.post(api.projects.create.path, async (req, res) => {
    try {
      const input = api.projects.create.input.parse(req.body);
      const { mode, ...projectData } = input;
      const project = await storage.createProject(projectData, mode || "github");
      res.status(201).json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
        return;
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.projects.get.path, async (req, res) => {
    const project = await storage.getProject(Number(req.params.id));
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json(project);
  });

  app.get(api.projects.getAnalysis.path, async (req, res) => {
    const analysis = await storage.getAnalysisByProjectId(Number(req.params.id));
    if (!analysis) {
      return res.status(404).json({ message: 'Analysis not found' });
    }
    res.json(analysis);
  });

  app.post(api.projects.analyze.path, async (req, res) => {
    const projectId = Number(req.params.id);
    const project = await storage.getProject(projectId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    runAnalysis(project.id, project.url, project.mode || "github");

    res.status(202).json({ message: "Analysis started" });
  });

  app.post(api.projects.analyzeReplit.path, async (req, res) => {
    try {
      const workspaceRoot = process.cwd();
      const folderName = path.basename(workspaceRoot);

      const project = await storage.createProject(
        { url: workspaceRoot, name: `Replit: ${folderName}` },
        "replit"
      );

      runAnalysis(project.id, workspaceRoot, "replit");

      res.status(201).json(project);
    } catch (err) {
      console.error("Error starting Replit analysis:", err);
      res.status(500).json({ message: "Failed to start Replit analysis" });
    }
  });

  app.get("/api/dossiers/lantern", (_req, res) => {
    const p = path.join(process.cwd(), "docs/dossiers/lantern_program_totality_dossier.md");
    if (!existsSync(p)) return res.status(404).json({ error: "Not found" });
    res.type("text/markdown").send(readFileSync(p, "utf8"));
  });

  app.get("/api/admin/analyzer-log", async (req, res) => {
    if (!requireDevAdmin(req, res)) return;
    try {
      if (!existsSync(LOG_FILE)) return res.json([]);
      const raw = await fs.readFile(LOG_FILE, "utf-8");
      const lines = raw.split("\n").filter(Boolean);
      const parsed = lines.map((l) => {
        try { return JSON.parse(l); } catch { return { parse_error: true, line: l }; }
      });
      res.json(parsed);
    } catch (err) {
      res.status(500).json({ error: "failed_to_read_log" });
    }
  });

  app.post("/api/admin/analyzer-log/clear", async (req, res) => {
    if (!requireDevAdmin(req, res)) return;
    try {
      await fs.mkdir(LOG_DIR, { recursive: true });
      await fs.rm(LOG_FILE, { force: true });
      await fs.writeFile(LOG_FILE, "", "utf8");
      logAdminEvent("log_cleared", {
        ip: req.ip,
        ua: String(req.headers["user-agent"] || ""),
      });
      return res.json({ ok: true });
    } catch (err) {
      console.error("Failed to clear analyzer log:", err);
      return res.status(500).json({ ok: false });
    }
  });

  app.post("/api/admin/reset-analyzer", async (req, res) => {
    if (!requireDevAdmin(req, res)) return;
    try {
      await storage.resetAnalyzerLogbook();
      await fs.rm(path.resolve(process.cwd(), "out"), { recursive: true, force: true });
      await fs.mkdir(path.resolve(process.cwd(), "out"), { recursive: true });
      logAdminEvent("reset_analyzer", {
        ip: req.ip,
        ua: String(req.headers["user-agent"] || ""),
      });
      console.log("[Admin] Analyzer logbook + DB + out/ reset");
      res.json({ ok: true });
    } catch (err) {
      console.error("[Admin] Reset failed:", err);
      res.status(500).json({ message: "Reset failed" });
    }
  });

  // ============== CI FEED ROUTES ==============

  const webhookRateLimiter = createRateLimiter(30, 60_000);

  app.post("/api/webhooks/github", async (req: Request, res: Response) => {
    if (!webhookRateLimiter()) {
      return res.status(429).json({ error: "rate_limited" });
    }

    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[Webhook] GITHUB_WEBHOOK_SECRET not set");
      return res.status(500).json({ error: "webhook_not_configured" });
    }

    const sigHeader = req.headers["x-hub-signature-256"] as string | undefined;
    if (!sigHeader) {
      return res.status(401).json({ error: "missing_signature" });
    }

    const rawBody = JSON.stringify(req.body);
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const sigBuf = Buffer.from(sigHeader);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(401).json({ error: "invalid_signature" });
    }

    const deliveryId = req.headers["x-github-delivery"] as string | undefined;
    const event = req.headers["x-github-event"] as string;

    if (!deliveryId || !event) {
      return res.status(400).json({ ok: false, error: "missing_delivery_id" });
    }

    const payload = req.body;
    const repoOwner = payload.repository?.owner?.login || payload.repository?.owner?.name;
    const repoNameForDelivery = payload.repository?.name;

    const isNew = await storage.checkAndRecordDelivery(deliveryId, event, repoOwner, repoNameForDelivery);
    if (!isNew) {
      console.log(`[Webhook] Replay blocked: delivery=${deliveryId}`);
      return res.status(202).json({ ok: true, deduped: true });
    }

    if (event === "push") {
      const owner = payload.repository?.owner?.login || payload.repository?.owner?.name;
      const repo = payload.repository?.name;
      const refFull = payload.ref || "";
      const ref = refFull.replace("refs/heads/", "");
      const sha = payload.after;

      if (!owner || !repo || !sha) {
        return res.status(400).json({ error: "missing_fields" });
      }

      const existing = await storage.findExistingCiRun(owner, repo, sha);
      if (existing) {
        console.log(`[Webhook] Deduplicated push for ${owner}/${repo}@${sha}`);
        return res.json({ ok: true, run_id: existing.id, deduplicated: true });
      }

      const run = await storage.createCiRun({ repoOwner: owner, repoName: repo, ref, commitSha: sha, eventType: "push", status: "QUEUED" });
      await storage.createCiJob(run.id);
      console.log(`[Webhook] Created run ${run.id} for push ${owner}/${repo}@${sha}`);
      return res.json({ ok: true, run_id: run.id });

    } else if (event === "pull_request") {
      const action = payload.action;
      if (!["opened", "synchronize", "reopened"].includes(action)) {
        return res.status(202).json({ ok: true, ignored: true });
      }

      const owner = payload.repository?.owner?.login;
      const repo = payload.repository?.name;
      const ref = payload.pull_request?.head?.ref;
      const sha = payload.pull_request?.head?.sha;

      if (!owner || !repo || !ref || !sha) {
        return res.status(400).json({ error: "missing_fields" });
      }

      const existing = await storage.findExistingCiRun(owner, repo, sha);
      if (existing) {
        return res.json({ ok: true, run_id: existing.id, deduplicated: true });
      }

      const run = await storage.createCiRun({ repoOwner: owner, repoName: repo, ref, commitSha: sha, eventType: "pull_request", status: "QUEUED" });
      await storage.createCiJob(run.id);
      console.log(`[Webhook] Created run ${run.id} for PR ${owner}/${repo}@${sha}`);
      return res.json({ ok: true, run_id: run.id });

    } else {
      return res.status(202).json({ ok: true, ignored: true });
    }
  });

  app.get("/api/ci/runs", async (req: Request, res: Response) => {
    const owner = String(req.query.owner || "");
    const repo = String(req.query.repo || "");
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    if (!owner || !repo) {
      return res.status(400).json({ error: "owner and repo query params required" });
    }

    const runs = await storage.getCiRuns(owner, repo, limit);
    res.json({ ok: true, runs });
  });

  app.get("/api/ci/runs/:id", async (req: Request, res: Response) => {
    const run = await storage.getCiRun(String(req.params.id));
    if (!run) {
      return res.status(404).json({ error: "run not found" });
    }
    res.json({ ok: true, run });
  });

  app.post("/api/ci/enqueue", async (req: Request, res: Response) => {
    const { owner, repo, ref, commit_sha, event_type } = req.body || {};
    if (!owner || !repo || !ref || !commit_sha) {
      return res.status(400).json({ error: "missing required fields: owner, repo, ref, commit_sha" });
    }

    const existing = await storage.findExistingCiRun(owner, repo, commit_sha);
    if (existing) {
      return res.json({ ok: true, run_id: existing.id, deduplicated: true });
    }

    const run = await storage.createCiRun({
      repoOwner: owner,
      repoName: repo,
      ref,
      commitSha: commit_sha,
      eventType: event_type || "manual",
      status: "QUEUED",
    });
    await storage.createCiJob(run.id);
    console.log(`[CI] Manual enqueue: run=${run.id} ${owner}/${repo}@${commit_sha}`);
    res.json({ ok: true, run_id: run.id });
  });

  app.post("/api/ci/worker/tick", async (_req: Request, res: Response) => {
    try {
      const result = await processOneJob();
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err?.message || err) });
    }
  });

  app.get("/api/ci/health", async (_req: Request, res: Response) => {
    try {
      const jobCounts = await storage.getCiJobCounts();
      const lastRun = await storage.getLastCompletedRun();
      const disk = getDiskStatus();
      res.json({
        ok: true,
        jobs: jobCounts,
        last_completed: lastRun ? {
          id: lastRun.id,
          status: lastRun.status,
          finished_at: lastRun.finishedAt,
          repo: `${lastRun.repoOwner}/${lastRun.repoName}`,
        } : null,
        ciTmpDir: disk.ciTmpDir,
        ciTmpDirFreeBytes: disk.ciTmpDirFreeBytes,
        ciTmpDirLowDisk: disk.ciTmpDirLowDisk,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: String(err?.message || err) });
    }
  });

  startWorkerLoop();

  return httpServer;
}

function createRateLimiter(maxRequests: number, windowMs: number) {
  const timestamps: number[] = [];
  return () => {
    const now = Date.now();
    while (timestamps.length > 0 && timestamps[0] < now - windowMs) {
      timestamps.shift();
    }
    if (timestamps.length >= maxRequests) return false;
    timestamps.push(now);
    return true;
  };
}

async function runAnalysis(projectId: number, source: string, mode: string) {
  const startTime = Date.now();
  console.log(`[Analyzer ${projectId}] Starting: mode=${mode} source=${source}`);
  logEvent(projectId, "start", { mode, source });
  await storage.updateProjectStatus(projectId, "analyzing");

  const outputDir = path.resolve(process.cwd(), "out", String(projectId));
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  let finished = false;
  const finishOnce = async (status: "completed" | "failed", reason?: string) => {
    if (finished) return;
    finished = true;
    const durationMs = Date.now() - startTime;
    const msg = `[Analyzer ${projectId}] Finalized: status=${status} duration=${durationMs}ms${reason ? ` reason=${reason}` : ""}`;
    if (status === "failed") console.error(msg);
    else console.log(msg);
    logEvent(projectId, "finalize", { status, reason, durationMs });
    await storage.updateProjectStatus(projectId, status);
  };

  const pythonBin = path.join(process.cwd(), ".pythonlibs/bin/python3");
  if (!existsSync(pythonBin)) {
    logEvent(projectId, "fatal", { reason: "python_not_found", path: pythonBin });
    await finishOnce("failed", "python_not_found");
    return;
  }

  const args = ["-m", "server.analyzer.analyzer_cli", "analyze"];

  if (mode === "replit") {
    args.push("--replit");
  } else {
    args.push(source);
  }

  args.push("--output-dir", outputDir);

  const cmd = `${pythonBin} ${args.join(" ")}`;
  console.log(`[Analyzer ${projectId}] Executing: ${cmd}`);
  logEvent(projectId, "spawn", { cmd });

  const pythonProcess = spawn(pythonBin, args, {
    cwd: process.cwd(),
    env: { ...process.env },
  });

  const timeout = setTimeout(() => {
    if (finished) return;
    console.error(`[Analyzer ${projectId}] Timeout after 10 minutes — killing`);
    pythonProcess.kill("SIGKILL");
    void finishOnce("failed", "timeout_10m");
  }, Number(process.env.ANALYZER_TIMEOUT_MS) || 10 * 60 * 1000);

  let stdout = "";
  let stderr = "";

  pythonProcess.stdout.on("data", (data) => {
    stdout += data.toString();
    console.log(`[Analyzer ${projectId}]: ${data}`);
  });

  pythonProcess.stderr.on("data", (data) => {
    stderr += data.toString();
    console.error(`[Analyzer ${projectId} ERR]: ${data}`);
  });

  pythonProcess.on("error", (err) => {
    clearTimeout(timeout);
    console.error(`[Analyzer ${projectId}] Spawn error:`, err);
    logEvent(projectId, "spawn_error", { error: String(err) });
    void finishOnce("failed", "spawn_error");
  });

  pythonProcess.on("close", async (code) => {
    clearTimeout(timeout);
    if (finished) return;
    logEvent(projectId, "exit", { code });
    console.log(`[Analyzer ${projectId}] Exited code=${code}`);

    if (code === 0) {
      try {
        const requiredArtifacts = ["operate.json", "DOSSIER.md", "claims.json"];
        for (const artifact of requiredArtifacts) {
          if (!existsSync(path.join(outputDir, artifact))) {
            logEvent(projectId, "missing_artifact", { artifact });
            await finishOnce("failed", `missing_artifact:${artifact}`);
            return;
          }
        }

        const dossierPath = path.join(outputDir, "DOSSIER.md");
        const claimsPath = path.join(outputDir, "claims.json");
        const howtoPath = path.join(outputDir, "target_howto.json");
        const operatePath = path.join(outputDir, "operate.json");
        const coveragePath = path.join(outputDir, "coverage.json");

        const dossier = await fs.readFile(dossierPath, "utf-8").catch(() => "");
        const claims = JSON.parse(await fs.readFile(claimsPath, "utf-8").catch(() => "{}"));
        const howto = JSON.parse(await fs.readFile(howtoPath, "utf-8").catch(() => "{}"));
        let operate: any = null;
        try {
          operate = JSON.parse(await fs.readFile(operatePath, "utf-8"));
        } catch {
          operate = null;
        }
        const coverage = JSON.parse(await fs.readFile(coveragePath, "utf-8").catch(() => "{}"));

        await storage.createAnalysis({
          projectId,
          dossier,
          claims,
          howto,
          operate,
          coverage,
          unknowns: howto.unknowns || [],
        });

        await finishOnce("completed");
      } catch (err) {
        console.error(`[Analyzer ${projectId}] Error saving results:`, err);
        logEvent(projectId, "save_error", { error: String(err) });
        await finishOnce("failed", "save_error");
      }
    } else {
      logEvent(projectId, "nonzero_exit", { code, stderr: stderr.slice(-500) });
      await finishOnce("failed", `exit_code_${code}`);
    }
  });
}

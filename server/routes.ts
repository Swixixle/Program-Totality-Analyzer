import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import { existsSync, readFileSync } from "fs";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/health", async (_req, res) => {
    const dbOk = await storage.getProjects().then(() => true).catch(() => false);
    res.json({ ok: true, db: dbOk, uptime: process.uptime() });
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

  return httpServer;
}

async function runAnalysis(projectId: number, source: string, mode: string) {
  console.log(`[Analyzer ${projectId}] Starting: mode=${mode} source=${source}`);
  await storage.updateProjectStatus(projectId, "analyzing");

  const outputDir = path.resolve(process.cwd(), "out", String(projectId));
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  const pythonBin = path.join(process.cwd(), ".pythonlibs/bin/python3");
  if (!existsSync(pythonBin)) {
    console.error(`[Analyzer ${projectId}] FATAL: Python not found at ${pythonBin}`);
    await storage.updateProjectStatus(projectId, "failed");
    return;
  }

  const args = ["-m", "server.analyzer.analyzer_cli", "analyze"];

  if (mode === "replit") {
    args.push("--replit");
  } else {
    args.push(source);
  }

  args.push("--output-dir", outputDir);

  console.log(`[Analyzer ${projectId}] Executing: ${pythonBin} ${args.join(" ")}`);

  const pythonProcess = spawn(pythonBin, args, {
    cwd: process.cwd(),
    env: { ...process.env },
  });

  const timeout = setTimeout(async () => {
    console.error(`[Analyzer ${projectId}] Timeout after 10 minutes — killing`);
    pythonProcess.kill("SIGKILL");
    await storage.updateProjectStatus(projectId, "failed");
  }, 10 * 60 * 1000);

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

  pythonProcess.on("error", async (err) => {
    clearTimeout(timeout);
    console.error(`[Analyzer ${projectId}] Spawn error:`, err);
    await storage.updateProjectStatus(projectId, "failed");
  });

  pythonProcess.on("close", async (code) => {
    clearTimeout(timeout);
    console.log(`[Analyzer ${projectId}] Exited code=${code}`);

    if (code === 0) {
      try {
        const requiredArtifacts = ["operate.json", "DOSSIER.md", "claims.json"];
        for (const artifact of requiredArtifacts) {
          if (!existsSync(path.join(outputDir, artifact))) {
            console.error(`[Analyzer ${projectId}] Missing required artifact: ${artifact}`);
            await storage.updateProjectStatus(projectId, "failed");
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

        await storage.updateProjectStatus(projectId, "completed");
        console.log(`[Analyzer ${projectId}] Completed successfully`);
      } catch (err) {
        console.error(`[Analyzer ${projectId}] Error saving results:`, err);
        await storage.updateProjectStatus(projectId, "failed");
      }
    } else {
      console.error(`[Analyzer ${projectId}] Failed with stderr:\n${stderr}`);
      await storage.updateProjectStatus(projectId, "failed");
    }
  });
}

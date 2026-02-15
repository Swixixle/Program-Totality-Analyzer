import { storage } from "./storage";
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";

const CI_OUT_BASE = path.resolve(process.cwd(), "out", "ci");

export async function processOneJob(): Promise<{ processed: boolean; runId?: string; status?: string }> {
  const leased = await storage.leaseNextJob();
  if (!leased) return { processed: false };

  const { job, run } = leased;
  console.log(`[CI Worker] Leased job=${job.id} run=${run.id} repo=${run.repoOwner}/${run.repoName} sha=${run.commitSha}`);

  const outDir = path.join(CI_OUT_BASE, run.id);
  mkdirSync(outDir, { recursive: true });

  let tmpDir: string | null = null;
  try {
    tmpDir = await fetchRepo(run.repoOwner, run.repoName, run.commitSha);
    const result = await runAnalyzerOnDir(tmpDir, outDir, run.id);

    if (result.success) {
      await storage.updateCiRun(run.id, {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        outDir: `out/ci/${run.id}`,
        summaryJson: result.summary || null,
      });
      await storage.completeJob(job.id, "DONE");
      console.log(`[CI Worker] Run ${run.id} SUCCEEDED`);
      return { processed: true, runId: run.id, status: "SUCCEEDED" };
    } else {
      await storage.updateCiRun(run.id, {
        status: "FAILED",
        finishedAt: new Date(),
        error: result.error || "unknown_error",
        outDir: `out/ci/${run.id}`,
      });
      await storage.completeJob(job.id, "DONE", result.error);
      console.log(`[CI Worker] Run ${run.id} FAILED: ${result.error}`);
      return { processed: true, runId: run.id, status: "FAILED" };
    }
  } catch (err: any) {
    const errMsg = String(err?.message || err);
    console.error(`[CI Worker] Job ${job.id} exception:`, errMsg);

    if (job.attempts >= 3) {
      await storage.updateCiRun(run.id, {
        status: "FAILED",
        finishedAt: new Date(),
        error: `max_attempts: ${errMsg}`,
      });
      await storage.completeJob(job.id, "DEAD", errMsg);
    } else {
      await storage.completeJob(job.id, "DEAD", errMsg);
    }
    return { processed: true, runId: run.id, status: "FAILED" };
  } finally {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function fetchRepo(owner: string, repo: string, sha: string): Promise<string> {
  const tmpBase = path.resolve(process.env.CI_TMP_DIR || "/tmp/ci");
  const tmpDir = path.join(tmpBase, `${owner}-${repo}-${sha}-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  const repoUrl = `https://github.com/${owner}/${repo}.git`;
  const token = process.env.GITHUB_TOKEN;

  let cloneUrl = repoUrl;
  if (token) {
    cloneUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  }

  await execCommand("git", ["clone", "--depth", "1", cloneUrl, tmpDir]);

  await execCommand("git", ["-C", tmpDir, "fetch", "--depth", "1", "origin", sha]);
  await execCommand("git", ["-C", tmpDir, "checkout", sha]);

  return tmpDir;
}

function execCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd: process.cwd() });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function runAnalyzerOnDir(
  repoDir: string,
  outDir: string,
  runId: string
): Promise<{ success: boolean; error?: string; summary?: any }> {
  const pythonBin = path.join(process.cwd(), ".pythonlibs/bin/python3");
  if (!existsSync(pythonBin)) {
    return { success: false, error: "python_not_found" };
  }

  const args = ["-m", "server.analyzer.analyzer_cli", "analyze", repoDir, "--output-dir", outDir];
  console.log(`[CI Worker] Running analyzer: ${pythonBin} ${args.join(" ")}`);

  return new Promise((resolve) => {
    let stderr = "";
    const proc = spawn(pythonBin, args, {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve({ success: false, error: "timeout_10m" });
    }, Number(process.env.ANALYZER_TIMEOUT_MS) || 10 * 60 * 1000);

    proc.stdout.on("data", (d) => {
      console.log(`[CI Analyzer ${runId}]: ${d}`);
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
      console.error(`[CI Analyzer ${runId} ERR]: ${d}`);
    });
    proc.on("error", (err) => {
      clearTimeout(timeout);
      resolve({ success: false, error: `spawn_error: ${err}` });
    });
    proc.on("close", async (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        resolve({ success: false, error: `exit_code_${code}: ${stderr.slice(-300)}` });
        return;
      }

      try {
        let summary: any = null;
        const operatePath = path.join(outDir, "operate.json");
        if (existsSync(operatePath)) {
          const raw = await fs.readFile(operatePath, "utf-8");
          const op = JSON.parse(raw);
          summary = {
            readiness: op.readiness_scores || null,
            boot_commands: (op.boot_commands || []).length,
            endpoints: (op.integration_points?.endpoints || []).length,
            env_vars: (op.integration_points?.env_vars || []).length,
            gaps: (op.operational_gaps || []).length,
          };
        }
        resolve({ success: true, summary });
      } catch {
        resolve({ success: true, summary: null });
      }
    });
  });
}

let workerInterval: ReturnType<typeof setInterval> | null = null;

export function startWorkerLoop(intervalMs: number = 5000) {
  if (workerInterval) return;
  console.log(`[CI Worker] Starting background loop (every ${intervalMs}ms)`);
  workerInterval = setInterval(async () => {
    try {
      await processOneJob();
    } catch (err) {
      console.error("[CI Worker] Loop error:", err);
    }
  }, intervalMs);
}

export function stopWorkerLoop() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log("[CI Worker] Stopped background loop");
  }
}

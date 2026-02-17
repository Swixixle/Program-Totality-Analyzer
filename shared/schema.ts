import { pgTable, text, serial, integer, boolean, timestamp, jsonb, index, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  name: text("name").notNull(),
  mode: text("mode").notNull().default("github"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  dossier: text("dossier"),
  claims: jsonb("claims"),
  howto: jsonb("howto"),
  operate: jsonb("operate"),
  coverage: jsonb("coverage"),
  unknowns: jsonb("unknowns"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ciRuns = pgTable("ci_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  repoOwner: text("repo_owner").notNull(),
  repoName: text("repo_name").notNull(),
  ref: text("ref").notNull(),
  commitSha: text("commit_sha").notNull(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull().default("QUEUED"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  error: text("error"),
  errorCode: text("error_code"),
  outDir: text("out_dir"),
  summaryJson: jsonb("summary_json"),
}, (table) => [
  index("ci_runs_repo_idx").on(table.repoOwner, table.repoName, table.createdAt),
  index("ci_runs_sha_idx").on(table.commitSha),
  index("ci_runs_status_idx").on(table.status, table.createdAt),
]);

export const ciJobs = pgTable("ci_jobs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: uuid("run_id").notNull(),
  status: text("status").notNull().default("READY"),
  attempts: integer("attempts").notNull().default(0),
  leasedUntil: timestamp("leased_until"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ci_jobs_status_idx").on(table.status, table.createdAt),
  index("ci_jobs_lease_idx").on(table.leasedUntil),
]);

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, status: true, mode: true });
export const insertAnalysisSchema = createInsertSchema(analyses).omit({ id: true, createdAt: true });

export const webhookDeliveries = pgTable("webhook_deliveries", {
  deliveryId: text("delivery_id").primaryKey(),
  event: text("event").notNull(),
  repoOwner: text("repo_owner"),
  repoName: text("repo_name"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
}, (table) => [
  index("webhook_deliveries_received_idx").on(table.receivedAt),
]);

export const insertCiRunSchema = createInsertSchema(ciRuns).omit({ id: true, createdAt: true, startedAt: true, finishedAt: true, error: true, outDir: true, summaryJson: true });
export const insertCiJobSchema = createInsertSchema(ciJobs).omit({ id: true, createdAt: true, attempts: true, leasedUntil: true, lastError: true });

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type CiRun = typeof ciRuns.$inferSelect;
export type InsertCiRun = z.infer<typeof insertCiRunSchema>;
export type CiJob = typeof ciJobs.$inferSelect;
export type InsertCiJob = z.infer<typeof insertCiJobSchema>;

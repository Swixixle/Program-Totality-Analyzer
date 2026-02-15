import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  name: text("name").notNull(),
  mode: text("mode").notNull().default("github"), // github, local, replit
  status: text("status").notNull().default("pending"), // pending, analyzing, completed, failed
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

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, status: true, mode: true });
export const insertAnalysisSchema = createInsertSchema(analyses).omit({ id: true, createdAt: true });

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;

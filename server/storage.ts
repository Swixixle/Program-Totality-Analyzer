import { db } from "./db";
import { projects, analyses, type InsertProject, type InsertAnalysis, type Project, type Analysis } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  createProject(project: InsertProject, mode?: string): Promise<Project>;
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createAnalysis(analysis: InsertAnalysis): Promise<Analysis>;
  getAnalysisByProjectId(projectId: number): Promise<Analysis | undefined>;
  updateProjectStatus(id: number, status: string): Promise<Project>;
}

export class DatabaseStorage implements IStorage {
  async createProject(insertProject: InsertProject, mode: string = "github"): Promise<Project> {
    const [project] = await db.insert(projects).values({ ...insertProject, mode }).returning();
    return project;
  }

  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createAnalysis(insertAnalysis: InsertAnalysis): Promise<Analysis> {
    const [analysis] = await db.insert(analyses).values(insertAnalysis).returning();
    return analysis;
  }

  async getAnalysisByProjectId(projectId: number): Promise<Analysis | undefined> {
    const [analysis] = await db.select().from(analyses).where(eq(analyses.projectId, projectId)).orderBy(desc(analyses.createdAt)).limit(1);
    return analysis;
  }

  async updateProjectStatus(id: number, status: string): Promise<Project> {
    const [project] = await db.update(projects).set({ status }).where(eq(projects.id, id)).returning();
    return project;
  }
}

export const storage = new DatabaseStorage();

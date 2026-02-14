import { 
  type User, type InsertUser,
  type Case, type InsertCase,
  type Upload, type InsertUpload,
  type UploadPage, type InsertUploadPage,
  type Chunk, type InsertChunk,
  type ExtractionJob, type InsertExtractionJob,
  type ExtractionJobState,
  type Snapshot, type InsertSnapshot,
  type Corpus, type InsertCorpus,
  type CorpusSource, type InsertCorpusSource,
  type AnchorRecord, type InsertAnchorRecord,
  type ClaimRecord, type InsertClaimRecord,
  type EvidencePacket, type InsertEvidencePacket,
  type LedgerEventRow, type InsertLedgerEvent,
  type LedgerEventType, type LedgerEntityType,
  type PdfPage, type InsertPdfPage,
  type Constraint, type InsertConstraint,
  type IncidentReportRecord, type InsertIncidentReport,
  type ReportArtifact, type InsertReportArtifact,
  users, cases, uploads, uploadPages, chunks, extractionJobs, snapshots, corpora, corpusSources, anchorRecords, claimRecords, evidencePackets, ledgerEvents, pdfPages, constraints, incidentReports, reportArtifacts
} from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, isNull, desc, gt } from "drizzle-orm";
import * as crypto from "crypto";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createCase(data: InsertCase): Promise<Case>;
  getCase(id: string): Promise<Case | undefined>;
  listCases(): Promise<Case[]>;
  updateCase(id: string, data: Partial<InsertCase>): Promise<Case | undefined>;
  archiveCase(id: string): Promise<boolean>;
  
  createUpload(data: InsertUpload): Promise<Upload>;
  getUpload(id: string): Promise<Upload | undefined>;
  listUploadsForCase(caseId: string): Promise<Upload[]>;
  updateUploadState(id: string, state: string): Promise<Upload | undefined>;
  updateUpload(id: string, data: Partial<InsertUpload>): Promise<Upload | undefined>;
  
  createUploadPage(data: InsertUploadPage): Promise<UploadPage>;
  listPagesForUpload(uploadId: string): Promise<UploadPage[]>;
  
  createChunk(data: InsertChunk): Promise<Chunk>;
  listChunksForUpload(uploadId: string): Promise<Chunk[]>;
  listChunksForCase(caseId: string): Promise<Chunk[]>;
  
  // Extraction jobs
  createExtractionJob(data: InsertExtractionJob): Promise<ExtractionJob>;
  getExtractionJob(id: string): Promise<ExtractionJob | undefined>;
  updateExtractionJobState(id: string, state: ExtractionJobState, progress: number): Promise<ExtractionJob | undefined>;
  completeExtractionJob(id: string, packId: string, packData: string): Promise<ExtractionJob | undefined>;
  failExtractionJob(id: string, errorCode: string, errorMessage: string): Promise<ExtractionJob | undefined>;
  listPendingExtractionJobs(): Promise<ExtractionJob[]>;
  
  // Snapshots
  createSnapshot(data: InsertSnapshot): Promise<Snapshot>;
  getSnapshot(id: string): Promise<Snapshot | undefined>;
  listSnapshotsByCorpus(corpusId: string): Promise<Snapshot[]>;
  
  // Corpus
  createCorpus(data: InsertCorpus): Promise<Corpus>;
  createCorpusWithId(data: InsertCorpus & { id: string }): Promise<Corpus>;
  getCorpus(id: string): Promise<Corpus | undefined>;
  listCorpora(): Promise<Corpus[]>;
  createCorpusSource(data: InsertCorpusSource): Promise<CorpusSource>;
  getCorpusSource(id: string): Promise<CorpusSource | undefined>;
  listCorpusSources(corpusId: string): Promise<CorpusSource[]>;
  
  // Anchor Records
  createAnchorRecord(data: InsertAnchorRecord): Promise<AnchorRecord>;
  listAnchorRecordsByCorpus(corpusId: string): Promise<AnchorRecord[]>;
  listAnchorRecordsByCorpusFiltered(corpusId: string, role?: string, sourceId?: string): Promise<AnchorRecord[]>;
  countAnchorRecordsBySource(sourceId: string): Promise<number>;
  
  // Claim Records
  createClaimRecord(data: InsertClaimRecord): Promise<ClaimRecord>;
  listClaimRecordsByCorpus(corpusId: string): Promise<ClaimRecord[]>;
  getClaimRecord(id: string): Promise<ClaimRecord | undefined>;
  deleteClaimRecord(id: string): Promise<boolean>;
  
  // Evidence Packets
  createEvidencePacket(data: InsertEvidencePacket): Promise<EvidencePacket>;
  getEvidencePacket(id: string): Promise<EvidencePacket | undefined>;
  listEvidencePacketsByCorpus(corpusId: string): Promise<EvidencePacket[]>;
  getAnchorRecordsByIds(ids: string[]): Promise<AnchorRecord[]>;
  
  // Ledger Events (append-only)
  createLedgerEvent(
    corpusId: string,
    eventType: LedgerEventType,
    entityType: LedgerEntityType,
    entityId: string,
    payload: Record<string, any>
  ): Promise<LedgerEventRow>;
  listLedgerEvents(
    corpusId: string,
    options?: { limit?: number; after?: string; event_type?: LedgerEventType }
  ): Promise<LedgerEventRow[]>;
  getLedgerEvent(id: string): Promise<LedgerEventRow | undefined>;
  
  // PDF Pages
  createPdfPage(data: InsertPdfPage): Promise<PdfPage>;
  getPdfPage(sourceId: string, pageIndex: number): Promise<PdfPage | undefined>;
  listPdfPagesBySource(sourceId: string): Promise<PdfPage[]>;
  getAnchorRecord(id: string): Promise<AnchorRecord | undefined>;
  
  // Constraints
  createConstraint(data: InsertConstraint): Promise<Constraint>;
  listConstraintsByCorpus(corpusId: string): Promise<Constraint[]>;
  getConstraint(id: string): Promise<Constraint | undefined>;
  
  // Incident Reports
  createIncidentReport(data: InsertIncidentReport): Promise<IncidentReportRecord>;
  getIncidentReport(id: string): Promise<IncidentReportRecord | undefined>;
  listIncidentReports(): Promise<IncidentReportRecord[]>;
  finalizeIncidentReport(id: string, artifactHash: string): Promise<IncidentReportRecord | undefined>;
  
  // Report Artifacts
  createReportArtifact(data: InsertReportArtifact): Promise<ReportArtifact>;
  getReportArtifact(id: string): Promise<ReportArtifact | undefined>;
  listReportArtifacts(reportId: string): Promise<ReportArtifact[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createCase(data: InsertCase): Promise<Case> {
    const result = await db.insert(cases).values(data).returning();
    return result[0];
  }

  async getCase(id: string): Promise<Case | undefined> {
    const result = await db.select().from(cases)
      .where(and(eq(cases.id, id), isNull(cases.deletedAt)))
      .limit(1);
    return result[0];
  }

  async listCases(): Promise<Case[]> {
    return db.select().from(cases)
      .where(isNull(cases.deletedAt))
      .orderBy(desc(cases.createdAt));
  }

  async updateCase(id: string, data: Partial<InsertCase>): Promise<Case | undefined> {
    const result = await db.update(cases)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cases.id, id))
      .returning();
    return result[0];
  }

  async archiveCase(id: string): Promise<boolean> {
    const result = await db.update(cases)
      .set({ deletedAt: new Date(), status: "archived" })
      .where(eq(cases.id, id))
      .returning();
    return result.length > 0;
  }

  async createUpload(data: InsertUpload): Promise<Upload> {
    const result = await db.insert(uploads).values(data).returning();
    return result[0];
  }

  async getUpload(id: string): Promise<Upload | undefined> {
    const result = await db.select().from(uploads)
      .where(and(eq(uploads.id, id), isNull(uploads.deletedAt)))
      .limit(1);
    return result[0];
  }

  async listUploadsForCase(caseId: string): Promise<Upload[]> {
    return db.select().from(uploads)
      .where(and(eq(uploads.caseId, caseId), isNull(uploads.deletedAt)))
      .orderBy(desc(uploads.createdAt));
  }

  async updateUploadState(id: string, state: string): Promise<Upload | undefined> {
    const result = await db.update(uploads)
      .set({ ingestionState: state, updatedAt: new Date() })
      .where(eq(uploads.id, id))
      .returning();
    return result[0];
  }

  async updateUpload(id: string, data: Partial<InsertUpload>): Promise<Upload | undefined> {
    const result = await db.update(uploads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(uploads.id, id))
      .returning();
    return result[0];
  }

  async createUploadPage(data: InsertUploadPage): Promise<UploadPage> {
    const result = await db.insert(uploadPages).values(data).returning();
    return result[0];
  }

  async listPagesForUpload(uploadId: string): Promise<UploadPage[]> {
    return db.select().from(uploadPages)
      .where(and(eq(uploadPages.uploadId, uploadId), isNull(uploadPages.deletedAt)))
      .orderBy(uploadPages.pageNumber);
  }

  async createChunk(data: InsertChunk): Promise<Chunk> {
    const result = await db.insert(chunks).values(data).returning();
    return result[0];
  }

  async listChunksForUpload(uploadId: string): Promise<Chunk[]> {
    return db.select().from(chunks)
      .where(and(eq(chunks.uploadId, uploadId), isNull(chunks.deletedAt)))
      .orderBy(chunks.chunkIndex);
  }

  async listChunksForCase(caseId: string): Promise<Chunk[]> {
    return db.select().from(chunks)
      .where(and(eq(chunks.caseId, caseId), isNull(chunks.deletedAt)))
      .orderBy(chunks.uploadId, chunks.chunkIndex);
  }

  // Extraction jobs
  async createExtractionJob(data: InsertExtractionJob): Promise<ExtractionJob> {
    const result = await db.insert(extractionJobs).values(data).returning();
    return result[0];
  }

  async getExtractionJob(id: string): Promise<ExtractionJob | undefined> {
    const result = await db.select().from(extractionJobs)
      .where(eq(extractionJobs.id, id))
      .limit(1);
    return result[0];
  }

  async updateExtractionJobState(id: string, state: ExtractionJobState, progress: number): Promise<ExtractionJob | undefined> {
    const result = await db.update(extractionJobs)
      .set({ state, progress, updatedAt: new Date() })
      .where(eq(extractionJobs.id, id))
      .returning();
    return result[0];
  }

  async completeExtractionJob(id: string, packId: string, packData: string): Promise<ExtractionJob | undefined> {
    const result = await db.update(extractionJobs)
      .set({ 
        state: "complete", 
        progress: 100,
        packId, 
        packData, 
        updatedAt: new Date(),
        completedAt: new Date()
      })
      .where(eq(extractionJobs.id, id))
      .returning();
    return result[0];
  }

  async failExtractionJob(id: string, errorCode: string, errorMessage: string): Promise<ExtractionJob | undefined> {
    const result = await db.update(extractionJobs)
      .set({ 
        state: "failed", 
        errorCode, 
        errorMessage, 
        updatedAt: new Date(),
        completedAt: new Date()
      })
      .where(eq(extractionJobs.id, id))
      .returning();
    return result[0];
  }

  async listPendingExtractionJobs(): Promise<ExtractionJob[]> {
    // Return all non-terminal states to resume jobs after server restart
    const nonTerminalStates = ["queued", "parsing", "extracting", "sanitizing", "scoring", "packaging"];
    const result = await db.select().from(extractionJobs)
      .orderBy(extractionJobs.createdAt);
    return result.filter(job => nonTerminalStates.includes(job.state));
  }

  async createSnapshot(data: InsertSnapshot): Promise<Snapshot> {
    const result = await db.insert(snapshots).values(data).returning();
    return result[0];
  }

  async getSnapshot(id: string): Promise<Snapshot | undefined> {
    const result = await db.select().from(snapshots)
      .where(eq(snapshots.id, id))
      .limit(1);
    return result[0];
  }

  async listSnapshotsByCorpus(corpusId: string): Promise<Snapshot[]> {
    const result = await db.select().from(snapshots)
      .where(eq(snapshots.corpusId, corpusId))
      .orderBy(desc(snapshots.createdAt));
    return result;
  }

  async createCorpus(data: InsertCorpus): Promise<Corpus> {
    const result = await db.insert(corpora).values(data).returning();
    return result[0];
  }

  async createCorpusWithId(data: InsertCorpus & { id: string }): Promise<Corpus> {
    const result = await db.insert(corpora).values(data).returning();
    return result[0];
  }

  async getCorpus(id: string): Promise<Corpus | undefined> {
    const result = await db.select().from(corpora)
      .where(eq(corpora.id, id))
      .limit(1);
    return result[0];
  }

  async listCorpora(): Promise<Corpus[]> {
    return db.select().from(corpora)
      .orderBy(desc(corpora.createdAt));
  }

  async createCorpusSource(data: InsertCorpusSource): Promise<CorpusSource> {
    const result = await db.insert(corpusSources).values(data).returning();
    return result[0];
  }

  async getCorpusSource(id: string): Promise<CorpusSource | undefined> {
    const result = await db.select().from(corpusSources)
      .where(eq(corpusSources.id, id))
      .limit(1);
    return result[0];
  }

  async listCorpusSources(corpusId: string): Promise<CorpusSource[]> {
    return db.select().from(corpusSources)
      .where(eq(corpusSources.corpusId, corpusId))
      .orderBy(corpusSources.uploadedAt);
  }

  async createAnchorRecord(data: InsertAnchorRecord): Promise<AnchorRecord> {
    const result = await db.insert(anchorRecords).values(data).returning();
    return result[0];
  }

  async listAnchorRecordsByCorpus(corpusId: string): Promise<AnchorRecord[]> {
    return db.select().from(anchorRecords)
      .where(eq(anchorRecords.corpusId, corpusId))
      .orderBy(anchorRecords.createdAt);
  }

  async countAnchorRecordsBySource(sourceId: string): Promise<number> {
    const result = await db.select().from(anchorRecords)
      .where(eq(anchorRecords.sourceId, sourceId));
    return result.length;
  }

  async listAnchorRecordsByCorpusFiltered(corpusId: string, role?: string, sourceId?: string): Promise<AnchorRecord[]> {
    let anchors = await db.select().from(anchorRecords)
      .where(eq(anchorRecords.corpusId, corpusId))
      .orderBy(anchorRecords.sourceDocument, anchorRecords.pageRef, anchorRecords.id);
    
    if (sourceId) {
      anchors = anchors.filter(a => a.sourceId === sourceId);
    }
    
    if (role) {
      const sources = await db.select().from(corpusSources)
        .where(and(eq(corpusSources.corpusId, corpusId), eq(corpusSources.role, role)));
      const sourceIds = new Set(sources.map(s => s.id));
      anchors = anchors.filter(a => sourceIds.has(a.sourceId));
    }
    
    return anchors;
  }

  async createClaimRecord(data: InsertClaimRecord): Promise<ClaimRecord> {
    const result = await db.insert(claimRecords).values(data).returning();
    return result[0];
  }

  async listClaimRecordsByCorpus(corpusId: string): Promise<ClaimRecord[]> {
    return db.select().from(claimRecords)
      .where(eq(claimRecords.corpusId, corpusId))
      .orderBy(claimRecords.createdAt);
  }

  async getClaimRecord(id: string): Promise<ClaimRecord | undefined> {
    const result = await db.select().from(claimRecords)
      .where(eq(claimRecords.id, id))
      .limit(1);
    return result[0];
  }

  async deleteClaimRecord(id: string): Promise<boolean> {
    const result = await db.delete(claimRecords)
      .where(eq(claimRecords.id, id))
      .returning();
    return result.length > 0;
  }

  async createEvidencePacket(data: InsertEvidencePacket): Promise<EvidencePacket> {
    const result = await db.insert(evidencePackets).values(data).returning();
    return result[0];
  }

  async getEvidencePacket(id: string): Promise<EvidencePacket | undefined> {
    const result = await db.select().from(evidencePackets)
      .where(eq(evidencePackets.id, id))
      .limit(1);
    return result[0];
  }

  async listEvidencePacketsByCorpus(corpusId: string): Promise<EvidencePacket[]> {
    return db.select().from(evidencePackets)
      .where(eq(evidencePackets.corpusId, corpusId))
      .orderBy(evidencePackets.createdAt);
  }

  async getAnchorRecordsByIds(ids: string[]): Promise<AnchorRecord[]> {
    if (ids.length === 0) return [];
    const allAnchors = await db.select().from(anchorRecords);
    return allAnchors.filter(a => ids.includes(a.id));
  }

  async createLedgerEvent(
    corpusId: string,
    eventType: LedgerEventType,
    entityType: LedgerEntityType,
    entityId: string,
    payload: Record<string, any>
  ): Promise<LedgerEventRow> {
    const canonicalObj = {
      corpus_id: corpusId,
      event_type: eventType,
      entity: { entity_type: entityType, entity_id: entityId },
      payload: payload
    };
    const canonicalJson = JSON.stringify(canonicalObj);
    const hashHex = crypto.createHash("sha256").update(canonicalJson).digest("hex");

    const result = await db.insert(ledgerEvents).values({
      corpusId,
      eventType,
      entityType,
      entityId,
      payloadJson: JSON.stringify(payload),
      hashAlg: "SHA-256",
      hashHex
    }).returning();
    return result[0];
  }

  async listLedgerEvents(
    corpusId: string,
    options?: { limit?: number; after?: string; event_type?: LedgerEventType }
  ): Promise<LedgerEventRow[]> {
    const limit = Math.min(options?.limit || 100, 500);
    let result = await db.select().from(ledgerEvents)
      .where(eq(ledgerEvents.corpusId, corpusId))
      .orderBy(desc(ledgerEvents.occurredAt))
      .limit(limit);

    if (options?.after) {
      const afterDate = new Date(options.after);
      result = result.filter(e => e.occurredAt > afterDate);
    }
    if (options?.event_type) {
      result = result.filter(e => e.eventType === options.event_type);
    }
    return result;
  }

  async getLedgerEvent(id: string): Promise<LedgerEventRow | undefined> {
    const result = await db.select().from(ledgerEvents)
      .where(eq(ledgerEvents.id, id))
      .limit(1);
    return result[0];
  }

  async createPdfPage(data: InsertPdfPage): Promise<PdfPage> {
    const result = await db.insert(pdfPages).values(data).returning();
    return result[0];
  }

  async getPdfPage(sourceId: string, pageIndex: number): Promise<PdfPage | undefined> {
    const result = await db.select().from(pdfPages)
      .where(and(eq(pdfPages.sourceId, sourceId), eq(pdfPages.pageIndex, pageIndex)))
      .limit(1);
    return result[0];
  }

  async listPdfPagesBySource(sourceId: string): Promise<PdfPage[]> {
    return db.select().from(pdfPages)
      .where(eq(pdfPages.sourceId, sourceId));
  }

  async getAnchorRecord(id: string): Promise<AnchorRecord | undefined> {
    const result = await db.select().from(anchorRecords)
      .where(eq(anchorRecords.id, id))
      .limit(1);
    return result[0];
  }

  async createConstraint(data: InsertConstraint): Promise<Constraint> {
    const result = await db.insert(constraints).values(data).returning();
    return result[0];
  }

  async listConstraintsByCorpus(corpusId: string): Promise<Constraint[]> {
    return db.select().from(constraints)
      .where(eq(constraints.corpusId, corpusId));
  }

  async getConstraint(id: string): Promise<Constraint | undefined> {
    const result = await db.select().from(constraints)
      .where(eq(constraints.id, id))
      .limit(1);
    return result[0];
  }
  
  async createIncidentReport(data: InsertIncidentReport): Promise<IncidentReportRecord> {
    const result = await db.insert(incidentReports).values(data).returning();
    return result[0];
  }
  
  async getIncidentReport(id: string): Promise<IncidentReportRecord | undefined> {
    const result = await db.select().from(incidentReports)
      .where(eq(incidentReports.id, id))
      .limit(1);
    return result[0];
  }
  
  async listIncidentReports(): Promise<IncidentReportRecord[]> {
    return db.select().from(incidentReports)
      .orderBy(desc(incidentReports.createdAt));
  }
  
  async finalizeIncidentReport(id: string, artifactHash: string): Promise<IncidentReportRecord | undefined> {
    const result = await db.update(incidentReports)
      .set({
        immutableState: "finalized",
        artifactHash: artifactHash,
        finalizedAt: new Date()
      })
      .where(eq(incidentReports.id, id))
      .returning();
    return result[0];
  }
  
  async createReportArtifact(data: InsertReportArtifact): Promise<ReportArtifact> {
    const result = await db.insert(reportArtifacts).values(data).returning();
    return result[0];
  }
  
  async getReportArtifact(id: string): Promise<ReportArtifact | undefined> {
    const result = await db.select().from(reportArtifacts)
      .where(eq(reportArtifacts.id, id))
      .limit(1);
    return result[0];
  }
  
  async listReportArtifacts(reportId: string): Promise<ReportArtifact[]> {
    return db.select().from(reportArtifacts)
      .where(eq(reportArtifacts.reportId, reportId))
      .orderBy(desc(reportArtifacts.createdAt));
  }
}

export const storage = new DatabaseStorage();

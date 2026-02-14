import { receipts, interpretations, researchRecords, llmObservations, exportJobs, savedViews, auditEvents, auditHead, auditCheckpoints, threads, threadMessages, type Receipt, type InsertReceipt, type Interpretation, type InsertInterpretation, type ExportJob, type InsertExportJob, type SavedView, type InsertSavedView, type AuditEvent, type InsertAuditEvent, type AuditHead, type AuditCheckpoint, type Thread, type InsertThread, type ThreadMessage, type InsertThreadMessage } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, like, or, isNull, desc, asc, sql, count } from "drizzle-orm";
import { randomUUID } from "crypto";
import { stableStringifyStrict, auditPayloadV1, hashAuditPayload, type AuditEventFields } from "./audit-canon";
import { buildCheckpointPayload, signCheckpoint, CHECKPOINT_INTERVAL } from "./checkpoint-signer";

// Research record insert type
export interface InsertResearchRecord {
  researchId: string;
  datasetVersion: string;
  captureDateBucket: string;
  verificationDateBucket: string;
  platformCategory: string;
  verificationOutcome: string;
  signatureOutcome: string;
  chainOutcome: string;
  structuralStats: string;
  anomalyIndicators: string;
  riskCategories: string;
  piiPresence: string;
  killSwitchEngaged: number;
  interpretationBucket: string;
  consentScope: string;
  createdAtBucket: string;
}

export type ResearchRecordRow = typeof researchRecords.$inferSelect;

// P6: LLM Observation types (SENSOR MODE - separate from verification)
export interface InsertLlmObservation {
  observationId: string;
  receiptId: string;
  modelId: string;
  observationType: string;
  basedOn: string;
  content: string;
  confidenceStatement: string;
  limitations: string; // JSON array
  createdAt: string;
}

export type LlmObservationRow = typeof llmObservations.$inferSelect;

export interface ResearchExportFilters {
  startDate?: string;
  endDate?: string;
  platformCategory?: string;
  verificationOutcome?: string;
}

export interface AuditAppendInput {
  action: string;
  actor: string;
  receiptId?: string | null;
  exportId?: string | null;
  savedViewId?: string | null;
  payload: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditVerifyResult {
  ok: boolean;
  status: "EMPTY" | "GENESIS" | "LINKED" | "BROKEN";
  checked: number;
  checkedEvents: number;
  totalEvents: number;
  partial: boolean;
  head: { seq: number; hash: string } | null;
  expectedHead: { seq: number; hash: string } | null;
  firstBadSeq: number | null;
  break: {
    seq: number;
    reason: "prevHash_mismatch" | "hash_mismatch" | "seq_gap" | "version_mismatch" | "unknown_payload_version" | "partial_coverage";
    expectedPrevHash?: string;
    foundPrevHash?: string;
    expectedHash?: string;
    foundHash?: string;
    detail?: string;
  } | null;
}

export interface PagedAuditParams {
  page: number;
  pageSize: number;
  action?: string;
  receiptId?: string;
  exportId?: string;
  savedViewId?: string;
}

export interface PagedAuditResult {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PagedReceiptsParams {
  page: number;
  pageSize: number;
  status?: string;
  q?: string;
  hasForensics?: boolean;
  killSwitch?: boolean;
  order?: "asc" | "desc";
  beforeDate?: string;
}

export interface PagedReceiptsResult {
  items: Receipt[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IStorage {
  getReceipt(receiptId: string): Promise<Receipt | undefined>;
  getReceiptById(id: string): Promise<Receipt | undefined>;
  getAllReceipts(): Promise<Receipt[]>;
  getPagedReceipts(params: PagedReceiptsParams): Promise<PagedReceiptsResult>;
  createReceipt(receipt: InsertReceipt): Promise<{ receipt: Receipt; alreadyExists: boolean }>;
  updateReceiptKillSwitch(receiptId: string): Promise<Receipt | undefined>;
  getInterpretations(receiptId: string): Promise<Interpretation[]>;
  createInterpretation(interpretation: InsertInterpretation): Promise<Interpretation>;
  createResearchRecord(record: InsertResearchRecord): Promise<ResearchRecordRow>;
  getResearchRecords(filters?: ResearchExportFilters): Promise<ResearchRecordRow[]>;
  createLlmObservation(observation: InsertLlmObservation): Promise<LlmObservationRow>;
  getLlmObservations(receiptId: string): Promise<LlmObservationRow[]>;
  createExportJob(job: InsertExportJob): Promise<ExportJob>;
  getExportJob(exportId: string): Promise<ExportJob | undefined>;
  updateExportJob(exportId: string, updates: Partial<Pick<ExportJob, "status" | "completed" | "total" | "filePath" | "errorMessage">>): Promise<ExportJob | undefined>;
  listSavedViews(): Promise<SavedView[]>;
  createSavedView(view: InsertSavedView): Promise<SavedView>;
  getSavedView(id: string): Promise<SavedView | undefined>;
  getSavedViewByName(name: string): Promise<SavedView | undefined>;
  updateSavedView(id: string, updates: Partial<Pick<SavedView, "name" | "description" | "filtersJson" | "updatedAt">>): Promise<SavedView | undefined>;
  deleteSavedView(id: string): Promise<boolean>;
  appendAuditEvent(input: AuditAppendInput): Promise<AuditEvent>;
  getAuditEventsPaged(params: PagedAuditParams): Promise<PagedAuditResult>;
  verifyAuditChain(limit?: number, strict?: boolean, fromSeq?: number, toSeq?: number): Promise<AuditVerifyResult>;
  ensureAuditHead(): Promise<void>;
  getAuditHead(): Promise<AuditHead | null>;
  getAuditEventCount(): Promise<number>;
  createThread(thread: InsertThread): Promise<Thread>;
  getThread(threadId: string): Promise<Thread | undefined>;
  getThreadsByReceipt(receiptId: string): Promise<Thread[]>;
  createThreadMessage(message: InsertThreadMessage): Promise<ThreadMessage>;
  getThreadMessages(threadId: string): Promise<ThreadMessage[]>;
}

export class DatabaseStorage implements IStorage {
  async getReceipt(receiptId: string): Promise<Receipt | undefined> {
    const result = await db.select().from(receipts).where(eq(receipts.receiptId, receiptId)).limit(1);
    return result[0];
  }

  async getReceiptById(id: string): Promise<Receipt | undefined> {
    const result = await db.select().from(receipts).where(eq(receipts.id, id)).limit(1);
    return result[0];
  }

  async getAllReceipts(): Promise<Receipt[]> {
    return db.select().from(receipts).orderBy(receipts.createdAt);
  }

  async getPagedReceipts(params: PagedReceiptsParams): Promise<PagedReceiptsResult> {
    const conditions = [];

    if (params.status) {
      conditions.push(eq(receipts.verificationStatus, params.status));
    }
    if (params.q) {
      conditions.push(like(receipts.receiptId, `%${params.q}%`));
    }
    if (params.hasForensics === true) {
      conditions.push(sql`${receipts.forensicsJson} IS NOT NULL AND ${receipts.forensicsJson} != ''`);
    } else if (params.hasForensics === false) {
      conditions.push(or(isNull(receipts.forensicsJson), eq(receipts.forensicsJson, "")));
    }
    if (params.killSwitch === true) {
      conditions.push(eq(receipts.hindsightKillSwitch, 1));
    } else if (params.killSwitch === false) {
      conditions.push(eq(receipts.hindsightKillSwitch, 0));
    }
    if (params.beforeDate) {
      conditions.push(sql`${receipts.createdAt} <= ${params.beforeDate}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderDir = params.order === "asc" ? asc : desc;
    const orderBy = [orderDir(receipts.createdAt), desc(receipts.receiptId)];

    const offset = (params.page - 1) * params.pageSize;

    const [items, totalResult] = await Promise.all([
      whereClause
        ? db.select().from(receipts).where(whereClause).orderBy(...orderBy).limit(params.pageSize).offset(offset)
        : db.select().from(receipts).orderBy(...orderBy).limit(params.pageSize).offset(offset),
      whereClause
        ? db.select({ count: count() }).from(receipts).where(whereClause)
        : db.select({ count: count() }).from(receipts),
    ]);

    const total = totalResult[0]?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
    const clampedPage = Math.max(1, Math.min(params.page, totalPages));

    return {
      items,
      total,
      page: clampedPage,
      pageSize: params.pageSize,
      totalPages,
    };
  }

  async createReceipt(receipt: InsertReceipt): Promise<{ receipt: Receipt; alreadyExists: boolean }> {
    const existing = await this.getReceipt(receipt.receiptId);
    if (existing) {
      if (existing.immutableLock === 1) {
        return { receipt: existing, alreadyExists: true };
      }
      const result = await db
        .update(receipts)
        .set(receipt)
        .where(eq(receipts.receiptId, receipt.receiptId))
        .returning();
      return { receipt: result[0], alreadyExists: false };
    }
    
    const result = await db.insert(receipts).values(receipt).returning();
    return { receipt: result[0], alreadyExists: false };
  }

  async updateReceiptKillSwitch(receiptId: string): Promise<Receipt | undefined> {
    const receipt = await this.getReceipt(receiptId);
    if (!receipt) return undefined;
    
    if (receipt.hindsightKillSwitch === 1) {
      return receipt;
    }
    
    const result = await db
      .update(receipts)
      .set({ hindsightKillSwitch: 1 })
      .where(eq(receipts.receiptId, receiptId))
      .returning();
    return result[0];
  }

  async getInterpretations(receiptId: string): Promise<Interpretation[]> {
    return db.select().from(interpretations).where(eq(interpretations.receiptId, receiptId)).orderBy(interpretations.createdAt);
  }

  async createInterpretation(interpretation: InsertInterpretation): Promise<Interpretation> {
    const result = await db.insert(interpretations).values(interpretation).returning();
    return result[0];
  }

  // P5: Research records
  async createResearchRecord(record: InsertResearchRecord): Promise<ResearchRecordRow> {
    const result = await db.insert(researchRecords).values(record).returning();
    return result[0];
  }

  async getResearchRecords(filters?: ResearchExportFilters): Promise<ResearchRecordRow[]> {
    const conditions = [];
    
    if (filters?.startDate) {
      conditions.push(gte(researchRecords.captureDateBucket, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(researchRecords.captureDateBucket, filters.endDate));
    }
    if (filters?.platformCategory) {
      conditions.push(eq(researchRecords.platformCategory, filters.platformCategory));
    }
    if (filters?.verificationOutcome) {
      conditions.push(eq(researchRecords.verificationOutcome, filters.verificationOutcome));
    }
    
    if (conditions.length === 0) {
      return db.select().from(researchRecords).orderBy(researchRecords.captureDateBucket);
    }
    
    return db.select().from(researchRecords)
      .where(and(...conditions))
      .orderBy(researchRecords.captureDateBucket);
  }

  // P6: LLM Observations (SENSOR MODE - separate from verification)
  async createLlmObservation(observation: InsertLlmObservation): Promise<LlmObservationRow> {
    const result = await db.insert(llmObservations).values(observation).returning();
    return result[0];
  }

  async getLlmObservations(receiptId: string): Promise<LlmObservationRow[]> {
    return db.select().from(llmObservations)
      .where(eq(llmObservations.receiptId, receiptId))
      .orderBy(llmObservations.createdAt);
  }

  async createExportJob(job: InsertExportJob): Promise<ExportJob> {
    const result = await db.insert(exportJobs).values(job).returning();
    return result[0];
  }

  async getExportJob(exportId: string): Promise<ExportJob | undefined> {
    const result = await db.select().from(exportJobs).where(eq(exportJobs.exportId, exportId)).limit(1);
    return result[0];
  }

  async updateExportJob(exportId: string, updates: Partial<Pick<ExportJob, "status" | "completed" | "total" | "filePath" | "errorMessage">>): Promise<ExportJob | undefined> {
    const setObj: Record<string, unknown> = {};
    if (updates.status !== undefined) setObj.status = updates.status;
    if (updates.completed !== undefined) setObj.completed = updates.completed;
    if (updates.total !== undefined) setObj.total = updates.total;
    if (updates.filePath !== undefined) setObj.filePath = updates.filePath;
    if (updates.errorMessage !== undefined) setObj.errorMessage = updates.errorMessage;

    const result = await db.update(exportJobs)
      .set(setObj)
      .where(eq(exportJobs.exportId, exportId))
      .returning();
    return result[0];
  }
  async listSavedViews(): Promise<SavedView[]> {
    return db.select().from(savedViews)
      .orderBy(desc(savedViews.updatedAt), asc(savedViews.name));
  }

  async createSavedView(view: InsertSavedView): Promise<SavedView> {
    const result = await db.insert(savedViews).values(view).returning();
    return result[0];
  }

  async getSavedView(id: string): Promise<SavedView | undefined> {
    const result = await db.select().from(savedViews).where(eq(savedViews.id, id)).limit(1);
    return result[0];
  }

  async getSavedViewByName(name: string): Promise<SavedView | undefined> {
    const result = await db.select().from(savedViews).where(eq(savedViews.name, name)).limit(1);
    return result[0];
  }

  async updateSavedView(id: string, updates: Partial<Pick<SavedView, "name" | "description" | "filtersJson" | "updatedAt">>): Promise<SavedView | undefined> {
    const result = await db.update(savedViews)
      .set(updates)
      .where(eq(savedViews.id, id))
      .returning();
    return result[0];
  }

  async deleteSavedView(id: string): Promise<boolean> {
    const result = await db.delete(savedViews).where(eq(savedViews.id, id)).returning();
    return result.length > 0;
  }

  async ensureAuditHead(): Promise<void> {
    const existing = await db.select().from(auditHead).where(eq(auditHead.id, 1)).limit(1);
    if (existing.length === 0) {
      await db.insert(auditHead).values({ id: 1, lastSeq: 0, lastHash: "GENESIS" });
    }
  }

  async getAuditHead(): Promise<AuditHead | null> {
    const result = await db.select().from(auditHead).where(eq(auditHead.id, 1)).limit(1);
    return result[0] ?? null;
  }

  async getAuditEventCount(): Promise<number> {
    const [row] = await db.select({ c: count() }).from(auditEvents);
    return row?.c ?? 0;
  }

  async appendAuditEvent(input: AuditAppendInput): Promise<AuditEvent> {
    return await db.transaction(async (tx) => {
      const [head] = await tx
        .select()
        .from(auditHead)
        .where(eq(auditHead.id, 1))
        .for("update");

      if (!head) {
        throw new Error("audit_head row missing — call ensureAuditHead() at startup");
      }

      const seq = head.lastSeq + 1;
      const prevHash = head.lastHash;
      const ts = new Date().toISOString();
      const id = randomUUID();
      const schemaVersion = "audit/1.1";

      const payloadObj = auditPayloadV1({
        schemaVersion,
        seq,
        ts,
        action: input.action,
        actor: input.actor,
        receiptId: input.receiptId ?? null,
        exportId: input.exportId ?? null,
        savedViewId: input.savedViewId ?? null,
        payload: input.payload,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        prevHash,
      });

      const hash = hashAuditPayload(payloadObj);
      const payloadVersion = (payloadObj as any)._v as number;

      const [event] = await tx.insert(auditEvents).values({
        id,
        seq,
        ts,
        action: input.action,
        actor: input.actor,
        receiptId: input.receiptId ?? null,
        exportId: input.exportId ?? null,
        savedViewId: input.savedViewId ?? null,
        payload: input.payload,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        prevHash,
        hash,
        schemaVersion,
        payloadV: payloadVersion,
      }).returning();

      await tx
        .update(auditHead)
        .set({ lastSeq: seq, lastHash: hash })
        .where(eq(auditHead.id, 1));

      if (CHECKPOINT_INTERVAL > 0 && seq % CHECKPOINT_INTERVAL === 0) {
        try {
          const [lastCheckpoint] = await tx
            .select()
            .from(auditCheckpoints)
            .orderBy(desc(auditCheckpoints.seq))
            .limit(1);

          const prevCheckpointId = lastCheckpoint?.id ?? null;
          const prevCheckpointHash = lastCheckpoint
            ? stableStringifyStrict(JSON.parse(lastCheckpoint.signedPayload)).slice(0, 64)
            : null;

          const eventsSinceCheckpoint = lastCheckpoint
            ? seq - lastCheckpoint.seq
            : seq;

          const cpPayload = buildCheckpointPayload(
            seq,
            hash,
            eventsSinceCheckpoint,
            prevCheckpointId,
            prevCheckpointHash,
          );

          const signed = signCheckpoint(cpPayload);

          await tx.insert(auditCheckpoints).values({
            id: signed.id,
            seq: signed.seq,
            hash: signed.hash,
            ts: signed.ts,
            prevCheckpointId: signed.prevCheckpointId,
            prevCheckpointHash: signed.prevCheckpointHash,
            signatureAlg: signed.signatureAlg,
            publicKeyId: signed.publicKeyId,
            signature: signed.signature,
            signedPayload: signed.signedPayload,
            eventCount: signed.eventCount,
          });

          console.log(JSON.stringify({
            ts: new Date().toISOString(),
            level: "info",
            event: "checkpoint.created",
            checkpointId: signed.id,
            seq: signed.seq,
            publicKeyId: signed.publicKeyId,
          }));
        } catch (cpErr) {
          console.error("Checkpoint creation failed (non-fatal):", cpErr);
        }
      }

      return event;
    });
  }

  async getCheckpoints(limit: number = 100): Promise<AuditCheckpoint[]> {
    return db
      .select()
      .from(auditCheckpoints)
      .orderBy(desc(auditCheckpoints.seq))
      .limit(limit);
  }

  async getLatestCheckpoint(): Promise<AuditCheckpoint | null> {
    const [row] = await db
      .select()
      .from(auditCheckpoints)
      .orderBy(desc(auditCheckpoints.seq))
      .limit(1);
    return row ?? null;
  }

  async verifyAuditChain(limit: number = 5000, strict: boolean = false, fromSeq?: number, toSeq?: number): Promise<AuditVerifyResult> {
    const cappedLimit = Math.min(limit, 50000);
    const normalize = (r: Omit<AuditVerifyResult, "ok" | "checkedEvents" | "firstBadSeq">): AuditVerifyResult => ({
      ok: r.status !== "BROKEN",
      ...r,
      checkedEvents: r.checked,
      firstBadSeq: r.break?.seq ?? null,
    });

    const [totalResult] = await db.select({ count: count() }).from(auditEvents);
    const totalEvents = totalResult?.count ?? 0;

    const conditions = [];
    if (fromSeq !== undefined) conditions.push(gte(auditEvents.seq, fromSeq));
    if (toSeq !== undefined) conditions.push(lte(auditEvents.seq, toSeq));

    let query = db
      .select()
      .from(auditEvents)
      .orderBy(asc(auditEvents.seq))
      .limit(cappedLimit);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const events = await query;

    if (events.length === 0) {
      return normalize({ status: "EMPTY", checked: 0, totalEvents: 0, partial: false, head: null, expectedHead: null, break: null });
    }

    const partial = events.length < totalEvents;

    if (strict && partial) {
      return normalize({
        status: "BROKEN",
        checked: 0,
        totalEvents,
        partial: true,
        head: null,
        expectedHead: null,
        break: {
          seq: 0,
          reason: "partial_coverage",
          detail: `Strict mode requires full coverage but limit=${cappedLimit} covers only ${events.length} of ${totalEvents} events`,
        },
      });
    }

    const isCursorQuery = fromSeq !== undefined || toSeq !== undefined;
    let expectedPrevHash = (fromSeq === undefined || fromSeq === 1) ? "GENESIS" : events[0]?.prevHash ?? "GENESIS";
    let lastVerified: { seq: number; hash: string } | null = null;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const expectedSeq = (fromSeq ?? 1) + i;

      if (ev.seq !== expectedSeq) {
        return normalize({
          status: "BROKEN",
          checked: i,
          totalEvents,
          partial,
          head: lastVerified,
          expectedHead: null,
          break: { seq: expectedSeq, reason: "seq_gap" },
        });
      }

      if (ev.prevHash !== expectedPrevHash) {
        return normalize({
          status: "BROKEN",
          checked: i,
          totalEvents,
          partial,
          head: lastVerified,
          expectedHead: null,
          break: {
            seq: ev.seq,
            reason: "prevHash_mismatch",
            expectedPrevHash,
            foundPrevHash: ev.prevHash,
          },
        });
      }

      const builderMap: Record<number, (fields: AuditEventFields) => Record<string, unknown>> = {
        1: auditPayloadV1,
      };

      const builder = builderMap[ev.payloadV];
      if (!builder) {
        return normalize({
          status: "BROKEN" as const,
          checked: i,
          totalEvents,
          partial,
          head: lastVerified,
          expectedHead: null,
          break: {
            seq: ev.seq,
            reason: "unknown_payload_version",
            detail: `payload_v=${ev.payloadV} has no registered builder`,
          },
        });
      }

      const recomputedPayload = builder({
        schemaVersion: ev.schemaVersion,
        seq: ev.seq,
        ts: ev.ts,
        action: ev.action,
        actor: ev.actor,
        receiptId: ev.receiptId,
        exportId: ev.exportId,
        savedViewId: ev.savedViewId,
        payload: ev.payload,
        ip: ev.ip,
        userAgent: ev.userAgent,
        prevHash: ev.prevHash,
      });

      if ((recomputedPayload as any)._v !== ev.payloadV) {
        return normalize({
          status: "BROKEN" as const,
          checked: i,
          totalEvents,
          partial,
          head: lastVerified,
          expectedHead: null,
          break: {
            seq: ev.seq,
            reason: "version_mismatch",
            detail: `payload_v column=${ev.payloadV} but builder produced _v=${(recomputedPayload as any)._v}`,
          },
        });
      }

      const recomputedHash = hashAuditPayload(recomputedPayload);

      if (recomputedHash !== ev.hash) {
        return normalize({
          status: "BROKEN",
          checked: i,
          totalEvents,
          partial,
          head: lastVerified,
          expectedHead: null,
          break: {
            seq: ev.seq,
            reason: "hash_mismatch",
            expectedHash: recomputedHash,
            foundHash: ev.hash,
          },
        });
      }

      expectedPrevHash = ev.hash;
      lastVerified = { seq: ev.seq, hash: ev.hash };
    }

    const [headRow] = await db.select().from(auditHead).where(eq(auditHead.id, 1)).limit(1);

    const chainStatus = events.length === 1 && (fromSeq === undefined || fromSeq === 1) ? "GENESIS" : "LINKED";

    if (!isCursorQuery && !partial && headRow && (headRow.lastSeq !== lastVerified!.seq || headRow.lastHash !== lastVerified!.hash)) {
      return normalize({
        status: "BROKEN",
        checked: events.length,
        totalEvents,
        partial: false,
        head: lastVerified,
        expectedHead: { seq: headRow.lastSeq, hash: headRow.lastHash },
        break: { seq: lastVerified!.seq, reason: "hash_mismatch", expectedHash: headRow.lastHash, foundHash: lastVerified!.hash },
      });
    }

    return normalize({
      status: chainStatus,
      checked: events.length,
      totalEvents,
      partial: isCursorQuery ? true : partial,
      head: lastVerified,
      expectedHead: headRow ? { seq: headRow.lastSeq, hash: headRow.lastHash } : null,
      break: null,
    });
  }

  async getAuditEventsPaged(params: PagedAuditParams): Promise<PagedAuditResult> {
    const conditions = [];

    if (params.action) {
      conditions.push(eq(auditEvents.action, params.action));
    }
    if (params.receiptId) {
      conditions.push(eq(auditEvents.receiptId, params.receiptId));
    }
    if (params.exportId) {
      conditions.push(eq(auditEvents.exportId, params.exportId));
    }
    if (params.savedViewId) {
      conditions.push(eq(auditEvents.savedViewId, params.savedViewId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (params.page - 1) * params.pageSize;

    const [items, totalResult] = await Promise.all([
      whereClause
        ? db.select().from(auditEvents).where(whereClause).orderBy(desc(auditEvents.ts)).limit(params.pageSize).offset(offset)
        : db.select().from(auditEvents).orderBy(desc(auditEvents.ts)).limit(params.pageSize).offset(offset),
      whereClause
        ? db.select({ count: count() }).from(auditEvents).where(whereClause)
        : db.select({ count: count() }).from(auditEvents),
    ]);

    const total = totalResult[0]?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / params.pageSize));

    return { items, total, page: params.page, pageSize: params.pageSize, totalPages };
  }

  async createThread(thread: InsertThread): Promise<Thread> {
    const result = await db.insert(threads).values(thread).returning();
    return result[0];
  }

  async getThread(threadId: string): Promise<Thread | undefined> {
    const result = await db.select().from(threads).where(eq(threads.threadId, threadId)).limit(1);
    return result[0];
  }

  async getThreadsByReceipt(receiptId: string): Promise<Thread[]> {
    return db.select().from(threads).where(eq(threads.receiptId, receiptId)).orderBy(desc(threads.createdAt));
  }

  async createThreadMessage(message: InsertThreadMessage): Promise<ThreadMessage> {
    const result = await db.insert(threadMessages).values(message).returning();
    return result[0];
  }

  async getThreadMessages(threadId: string): Promise<ThreadMessage[]> {
    return db.select().from(threadMessages).where(eq(threadMessages.threadId, threadId)).orderBy(asc(threadMessages.createdAt));
  }
}

export const storage = new DatabaseStorage();

export { stableStringifyStrict, auditPayloadV1, hashAuditPayload } from "./audit-canon";

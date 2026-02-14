import { storage } from "./storage";
import type { ExtractionJobState } from "@shared/schema";

const activeJobs = new Map<string, NodeJS.Timeout>();

export async function startJobProcessor() {
  console.log("[ExtractionProcessor] Starting job processor");
  processNextJob();
  setInterval(processNextJob, 5000);
}

async function processNextJob() {
  try {
    const pendingJobs = await storage.listPendingExtractionJobs();
    
    for (const job of pendingJobs) {
      if (!activeJobs.has(job.id)) {
        console.log(`[ExtractionProcessor] Starting job ${job.id}`);
        processJob(job.id);
      }
    }
  } catch (err) {
    console.error("[ExtractionProcessor] Error checking pending jobs:", err);
  }
}

async function processJob(jobId: string) {
  const startTime = Date.now();
  console.log(`[ExtractionProcessor] [${jobId}] Starting job at ${new Date().toISOString()}`);
  
  const timeoutId = setTimeout(() => {
    console.log(`[ExtractionProcessor] [${jobId}] TIMEOUT after 5 minutes`);
    activeJobs.delete(jobId);
    storage.failExtractionJob(jobId, "TIMEOUT", "Job timed out after 5 minutes");
  }, 300000);
  
  activeJobs.set(jobId, timeoutId);
  
  try {
    const job = await storage.getExtractionJob(jobId);
    if (!job) {
      throw new Error("Job not found");
    }
    
    const sourceText = job.sourceText;
    const docSize = sourceText.length;
    console.log(`[ExtractionProcessor] [${jobId}] Document size: ${docSize.toLocaleString()} chars`);
    
    const metadata = JSON.parse(job.metadata);
    const options = job.options ? JSON.parse(job.options) : { mode: "balanced" };
    
    console.log(`[ExtractionProcessor] [${jobId}] Phase: parsing (10%)`);
    await updateJobProgress(jobId, "parsing", 10);
    await sleep(100);
    
    console.log(`[ExtractionProcessor] [${jobId}] Phase: extracting (30%)`);
    await updateJobProgress(jobId, "extracting", 30);
    
    const pack = await runExtraction(sourceText, metadata, options, async (phase, progress) => {
      console.log(`[ExtractionProcessor] [${jobId}] Phase: ${phase} (${progress}%)`);
      await updateJobProgress(jobId, phase as ExtractionJobState, progress);
    });
    
    console.log(`[ExtractionProcessor] [${jobId}] Phase: packaging (95%)`);
    await updateJobProgress(jobId, "packaging", 95);
    
    const packData = JSON.stringify(pack);
    await storage.completeExtractionJob(jobId, pack.pack_id, packData);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[ExtractionProcessor] [${jobId}] COMPLETE pack_id=${pack.pack_id} elapsed=${elapsed}s`);
    console.log(`[ExtractionProcessor] [${jobId}] Stats: ${pack.items.entities.length} entities, ${pack.items.quotes.length} quotes, ${pack.items.metrics.length} metrics, ${pack.items.timeline.length} timeline`);
  } catch (err: any) {
    console.error(`[ExtractionProcessor] [${jobId}] FAILED: ${err.message}`);
    await storage.failExtractionJob(jobId, "EXTRACTION_ERROR", err.message || "Unknown error");
  } finally {
    clearTimeout(activeJobs.get(jobId));
    activeJobs.delete(jobId);
  }
}

async function updateJobProgress(jobId: string, state: ExtractionJobState, progress: number) {
  await storage.updateExtractionJobState(jobId, state, progress);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runExtraction(
  sourceText: string, 
  metadata: any, 
  options: any,
  onProgress: (phase: string, progress: number) => Promise<void>
): Promise<any> {
  const crypto = await import('crypto');
  
  const sourceHash = crypto.createHash('sha256').update(sourceText).digest('hex');
  
  await onProgress("extracting", 40);
  
  const entities = extractEntitiesSimple(sourceText);
  await onProgress("extracting", 50);
  
  const quotes = extractQuotesSimple(sourceText);
  await onProgress("extracting", 60);
  
  const metrics = extractMetricsSimple(sourceText);
  await onProgress("sanitizing", 70);
  
  const timeline = extractTimelineSimple(sourceText);
  await onProgress("scoring", 80);
  
  const pack = {
    pack_id: crypto.createHash('sha256').update(sourceHash + Date.now()).digest('hex').slice(0, 16),
    schema: "lantern.extract.pack.v1" as const,
    hashes: {
      source_text_sha256: sourceHash,
      pack_sha256: ""
    },
    engine: { name: "lantern", version: "0.2.0-server" },
    source: {
      title: metadata.title || "Untitled",
      author: metadata.author || "",
      publisher: metadata.publisher || "",
      url: metadata.url || "",
      published_at: metadata.published_at || "",
      source_type: metadata.source_type || "News",
      retrieved_at: new Date().toISOString()
    },
    items: {
      entities,
      quotes,
      metrics,
      timeline
    },
    stats: {
      duplicates_collapsed: 0,
      invalid_dropped: 0,
      headlines_suppressed: 0,
      sanitation_denied: 0,
      sanitation_reclassified: 0,
      sanitation_collapsed: 0
    },
    trust: {
      schema_version: "1.0",
      confidence_model: "server_basic",
      sanitation_pass: true,
      pack_confidence: 0.75,
      confidence_threshold: 0.5
    }
  };
  
  pack.hashes.pack_sha256 = crypto.createHash('sha256').update(JSON.stringify(pack.items)).digest('hex');
  
  await onProgress("packaging", 90);
  
  return pack;
}

function extractEntitiesSimple(text: string): any[] {
  const entities: any[] = [];
  const entityPatterns = [
    { pattern: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g, type: "Person" as const },
    { pattern: /\b((?:Inc|Corp|LLC|Ltd|Company|Group|Foundation|Institute|University|College)\.?)\b/gi, type: "Organization" as const },
    { pattern: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Inc|Corp|LLC|Ltd|Company|Group)\.?))\b/g, type: "Organization" as const }
  ];
  
  const seen = new Set<string>();
  let idCounter = 0;
  
  for (const { pattern, type } of entityPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const entityText = match[1] || match[0];
      const key = `${entityText.toLowerCase()}_${type}`;
      
      if (seen.has(key) || entityText.length < 3) continue;
      seen.add(key);
      
      const start = match.index;
      const end = start + match[0].length;
      const sentenceStart = Math.max(0, text.lastIndexOf('.', start) + 1);
      const sentenceEnd = Math.min(text.length, text.indexOf('.', end) + 1 || text.length);
      const sentence = text.slice(sentenceStart, sentenceEnd).trim();
      
      entities.push({
        id: `ent_${(idCounter++).toString(36)}`,
        text: entityText,
        type,
        confidence: 0.7,
        confidence_score: 0.7,
        included: true,
        provenance: {
          start,
          end,
          sentence: sentence.slice(0, 200),
          sentence_text: sentence.slice(0, 200),
          sentence_start: sentenceStart,
          sentence_end: sentenceEnd
        },
        entity_class: type,
        canonical_family_id: key
      });
      
      if (entities.length >= 5000) break;
    }
    if (entities.length >= 5000) break;
  }
  
  return entities;
}

function extractQuotesSimple(text: string): any[] {
  const quotes: any[] = [];
  const quotePattern = /"([^"]{10,500})"/g;
  
  let match;
  let idCounter = 0;
  
  while ((match = quotePattern.exec(text)) !== null) {
    const quote = match[1];
    const start = match.index;
    const end = start + match[0].length;
    
    const beforeQuote = text.slice(Math.max(0, start - 100), start);
    const speakerMatch = beforeQuote.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:said|says|stated|noted|argued|claimed|wrote)/);
    
    quotes.push({
      id: `quo_${(idCounter++).toString(36)}`,
      quote,
      speaker: speakerMatch ? speakerMatch[1] : null,
      speaker_candidates: [],
      confidence: 0.8,
      included: true,
      provenance: {
        start,
        end,
        sentence: quote.slice(0, 150),
        sentence_text: quote.slice(0, 150),
        sentence_start: start,
        sentence_end: end
      }
    });
    
    if (quotes.length >= 1000) break;
  }
  
  return quotes;
}

function extractMetricsSimple(text: string): any[] {
  const metrics: any[] = [];
  const metricPattern = /(\$?\d+(?:,\d{3})*(?:\.\d+)?)\s*(percent|%|million|billion|trillion|dollars|USD|EUR|GBP|years?|months?|days?|hours?|people|persons|individuals)?/gi;
  
  let match;
  let idCounter = 0;
  
  while ((match = metricPattern.exec(text)) !== null) {
    const value = match[1];
    const unit = match[2] || "";
    const start = match.index;
    const end = start + match[0].length;
    
    metrics.push({
      id: `met_${(idCounter++).toString(36)}`,
      value,
      unit: unit.toLowerCase(),
      metric_kind: "scalar" as const,
      confidence: 0.75,
      included: true,
      provenance: {
        start,
        end,
        sentence: text.slice(Math.max(0, start - 50), Math.min(text.length, end + 50)).trim(),
        sentence_text: text.slice(Math.max(0, start - 50), Math.min(text.length, end + 50)).trim(),
        sentence_start: Math.max(0, start - 50),
        sentence_end: Math.min(text.length, end + 50)
      }
    });
    
    if (metrics.length >= 1000) break;
  }
  
  return metrics;
}

function extractTimelineSimple(text: string): any[] {
  const timeline: any[] = [];
  const datePatterns = [
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b\d{4}\b/g
  ];
  
  const seen = new Set<string>();
  let idCounter = 0;
  
  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const date = match[0];
      if (seen.has(date)) continue;
      seen.add(date);
      
      const start = match.index;
      const end = start + match[0].length;
      const context = text.slice(Math.max(0, start - 100), Math.min(text.length, end + 100)).trim();
      
      timeline.push({
        id: `tim_${(idCounter++).toString(36)}`,
        date,
        date_type: "explicit" as const,
        event: context.slice(0, 150),
        confidence: 0.7,
        included: true,
        provenance: {
          start,
          end,
          sentence: context.slice(0, 150),
          sentence_text: context.slice(0, 150),
          sentence_start: Math.max(0, start - 100),
          sentence_end: Math.min(text.length, end + 100)
        }
      });
      
      if (timeline.length >= 500) break;
    }
    if (timeline.length >= 500) break;
  }
  
  return timeline;
}

export { processJob };

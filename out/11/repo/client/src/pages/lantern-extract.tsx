import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileJson, 
  FileText, 
  RefreshCw, 
  ChevronRight,
  ChevronLeft,
  Users, 
  Quote, 
  Hash, 
  CalendarClock,
  Sliders,
  Activity,
  Save,
  FolderOpen,
  Filter,
  Check,
  Copy,
  GitCompare,
  Play,
  AlertTriangle,
  ArrowRight,
  Download,
  Upload,
  Trash2,
  Paperclip,
  Loader2
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import jsPDF from "jspdf";
import { extract, computePackId, diffPacks, scoreExtraction, LanternPack, ExtractionOptions, PackDiff, QualityReport } from "@/lib/lanternExtract";
import type { ExtractRequest, WorkerMessage } from "@/workers/extraction.worker";
import ExtractionWorker from "@/workers/extraction.worker?worker";
import { persistence, debouncedSave, type StorageStatus, type LibraryState, AnyPack, isExtractPack, isDossierPack } from "@/lib/storage";
import { cn } from "@/lib/utils";
import fixtures from "@/fixtures/metric_and_attribution_edge_cases.json";
import { createDossierFromExtract } from "@/lib/converters/extract_to_dossier";
import { Pack } from "@/lib/schema/pack_v1";
import { useLocation } from "wouter";

// ... (Persistence Mock REMOVED) - storage.ts is now authoritative

export default function LanternExtract() {
  const [step, setStep] = useState<"input" | "extract" | "export" | "quality">("input");
  const [showSaved, setShowSaved] = useState(false);
  const [savedPacks, setSavedPacks] = useState<AnyPack[]>([]);
  const [filterSourceHash, setFilterSourceHash] = useState<string | null>(null);
  
  // Storage State
  const [storageStatus, setStorageStatus] = useState<StorageStatus>("idle");
  const [selectedPackIds, setSelectedPackIds] = useState<Set<string>>(new Set());
  
  // Pagination State
  const PAGE_SIZE = 100;
  const [entityPage, setEntityPage] = useState(1);
  const [quotePage, setQuotePage] = useState(1);
  const [metricPage, setMetricPage] = useState(1);
  const [timelinePage, setTimelinePage] = useState(1);
  const packIdRef = useRef<string | null>(null);

  // Diff View State
  const [diffMode, setDiffMode] = useState(false);
  const [diffPackId, setDiffPackId] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<PackDiff | null>(null);
  
  // ... (Quality State same as before)
  const [qualityReports, setQualityReports] = useState<QualityReport[]>([]);
  const [runningTests, setRunningTests] = useState(false);
  const [modeValidation, setModeValidation] = useState<{ pass: boolean; warnings: string[] } | null>(null);
  const [determinismStatus, setDeterminismStatus] = useState<"pending" | "pass" | "fail">("pending");
  const [provenanceStatus, setProvenanceStatus] = useState<"pending" | "pass" | "fail">("pending");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<"idle" | "running" | "completed" | "failed" | "timeout">("idle");
  const [extractionElapsed, setExtractionElapsed] = useState(0);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionPhase, setExtractionPhase] = useState<string>("");
  const [extractionProgress, setExtractionProgress] = useState<number>(0);
  const extractionStartTime = useRef<number>(0);
  const extractionTimer = useRef<NodeJS.Timeout | null>(null);
  const sourceTextRef = useRef<string>("");
  const workerRef = useRef<Worker | null>(null);

  const [sourceText, setSourceText] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState({
    title: "",
    author: "",
    publisher: "",
    url: "",
    published_at: "",
    source_type: "News"
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingFile(true);
    setUploadError(null);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const ext = file.name.split(".").pop()?.toLowerCase();
      const endpoint = ext === "pdf" ? "/api/upload/pdf" : "/api/upload";
      
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData
      });
      
      const data = await res.json();
      console.log("[Upload Response]", data);
      
      if (!res.ok) {
        setUploadError(data.message || "Upload failed");
        return;
      }
      
      setSourceText(data.text);
      const cleanFilename = data.filename?.replace(/\.(txt|md|pdf)$/i, "") || "";
      if (cleanFilename && !metadata.title) {
        setMetadata(prev => ({ ...prev, title: cleanFilename }));
      }
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };
  
  const [extractOptions, setExtractOptions] = useState<ExtractionOptions>({ mode: "balanced" });
  const [pack, setPack] = useState<LanternPack | null>(null);
  
  // Reset pagination when pack changes and clamp pages to valid range
  useEffect(() => {
    if (!pack) return;
    
    // Reset pages on pack change
    if (pack.pack_id !== packIdRef.current) {
      packIdRef.current = pack.pack_id;
      setEntityPage(1);
      setQuotePage(1);
      setMetricPage(1);
      setTimelinePage(1);
      return;
    }
    
    // Clamp pages to valid ranges (handles data changes)
    const entityMax = Math.max(1, Math.ceil(pack.items.entities.length / PAGE_SIZE));
    const quoteMax = Math.max(1, Math.ceil(pack.items.quotes.length / PAGE_SIZE));
    const metricMax = Math.max(1, Math.ceil(pack.items.metrics.length / PAGE_SIZE));
    const timelineMax = Math.max(1, Math.ceil(pack.items.timeline.length / PAGE_SIZE));
    
    if (entityPage > entityMax) setEntityPage(entityMax);
    if (quotePage > quoteMax) setQuotePage(quoteMax);
    if (metricPage > metricMax) setMetricPage(metricMax);
    if (timelinePage > timelineMax) setTimelinePage(timelineMax);
  }, [pack?.pack_id, pack?.items.entities.length, pack?.items.quotes.length, pack?.items.metrics.length, pack?.items.timeline.length, entityPage, quotePage, metricPage, timelinePage]);
  
  // Persistence keys for recovery
  const DRAFT_SOURCE_KEY = "lantern_draft_source";
  const DRAFT_META_KEY = "lantern_draft_meta";
  const DRAFT_EXTRACTING_KEY = "lantern_extracting";
  const JOB_ID_KEY = "lantern_job_id";
  
  // Server job state
  const [serverJobId, setServerJobId] = useState<string | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isServerJobRef = useRef<boolean>(false); // Ref to track if using server job (avoids stale closure)
  const STALL_THRESHOLD_MS = 30000; // 30 seconds without progress = stalled
  const SERVER_JOB_THRESHOLD = 75000; // Use server job for docs over 75K chars

  // Stall state tracking
  const [isStalled, setIsStalled] = useState(false);
  const lastProgressRef = useRef<number>(0);
  const lastProgressTimeRef = useRef<number>(Date.now());

  // Polling function for server jobs
  const pollJobStatus = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        console.error(`[Client] [${jobId}] Poll failed: Job not found`);
        throw new Error("Job not found");
      }
      const job = await res.json();
      
      const now = Date.now();
      setLastHeartbeat(now);
      
      // Stall detection: if progress hasn't changed for STALL_THRESHOLD_MS
      if (job.progress !== lastProgressRef.current) {
        lastProgressRef.current = job.progress;
        lastProgressTimeRef.current = now;
        if (isStalled) {
          console.log(`[Client] [${jobId}] Resuming from stall - progress now ${job.progress}%`);
          setIsStalled(false);
        }
      } else if (now - lastProgressTimeRef.current > STALL_THRESHOLD_MS && !isStalled) {
        console.warn(`[Client] [${jobId}] STALL DETECTED - no progress for ${STALL_THRESHOLD_MS/1000}s`);
        setIsStalled(true);
      }
      
      console.log(`[Client] [${jobId}] Poll: state=${job.state} progress=${job.progress}% stalled=${isStalled}`);
      setExtractionPhase(job.state.charAt(0).toUpperCase() + job.state.slice(1) + "...");
      setExtractionProgress(job.progress);
      
      if (job.state === "complete") {
        // Job completed successfully
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (extractionTimer.current) clearInterval(extractionTimer.current);
        
        localStorage.removeItem(JOB_ID_KEY);
        localStorage.removeItem(DRAFT_SOURCE_KEY);
        localStorage.removeItem(DRAFT_META_KEY);
        localStorage.removeItem(DRAFT_EXTRACTING_KEY);
        
        console.log(`[Client] [${jobId}] COMPLETE pack_id=${job.pack_id}`);
        setPack(job.pack);
        setStep("extract");
        setExtractionStatus("completed");
        setIsExtracting(false);
        setServerJobId(null);
        isServerJobRef.current = false;
        setIsStalled(false);
        return true;
      }
      
      if (job.state === "failed") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (extractionTimer.current) clearInterval(extractionTimer.current);
        
        localStorage.removeItem(JOB_ID_KEY);
        localStorage.removeItem(DRAFT_EXTRACTING_KEY);
        
        console.error(`[Client] [${jobId}] FAILED: ${job.error_message}`);
        setExtractionStatus("failed");
        setExtractionError(job.error_message || "Server job failed. Your source text is preserved.");
        setIsExtracting(false);
        setServerJobId(null);
        isServerJobRef.current = false;
        setIsStalled(false);
        return true;
      }
      
      return false;
    } catch (err: any) {
      console.error(`[Client] Poll error:`, err);
      return false;
    }
  };

  // Start polling for a server job
  const startJobPolling = (jobId: string) => {
    console.log(`[Client] [${jobId}] Starting job polling`);
    setServerJobId(jobId);
    setLastHeartbeat(Date.now());
    lastProgressRef.current = 0;
    lastProgressTimeRef.current = Date.now();
    setIsStalled(false);
    
    // Clear any existing polling
    if (pollingRef.current) clearInterval(pollingRef.current);
    
    // Poll every 2 seconds
    pollingRef.current = setInterval(async () => {
      const done = await pollJobStatus(jobId);
      if (done && pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }, 2000);
  };

  // Cancel stalled job and retry
  const cancelStalledJob = () => {
    console.log(`[Client] User cancelled stalled job ${serverJobId}`);
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (extractionTimer.current) clearInterval(extractionTimer.current);
    
    localStorage.removeItem(JOB_ID_KEY);
    localStorage.removeItem(DRAFT_EXTRACTING_KEY);
    
    setExtractionStatus("failed");
    setExtractionError("Job appeared stalled and was cancelled. Your source text is preserved. You can try again.");
    setIsExtracting(false);
    setServerJobId(null);
    isServerJobRef.current = false;
    setIsStalled(false);
  };

  // Init Load
  useEffect(() => {
    const load = async () => {
        const library = await persistence.loadLibrary();
        if (library) {
            setSavedPacks(library.packs);
        } else {
            setSavedPacks([]); 
        }
        
        // Recovery: Check for active server job
        const savedJobId = localStorage.getItem(JOB_ID_KEY);
        if (savedJobId) {
          console.log("[Recovery] Found active server job:", savedJobId);
          isServerJobRef.current = true;
          setIsExtracting(true);
          setExtractionStatus("running");
          setExtractionPhase("Reconnecting to job...");
          extractionStartTime.current = Date.now();
          
          // Restore source text for display
          const savedSource = localStorage.getItem(DRAFT_SOURCE_KEY);
          const savedMeta = localStorage.getItem(DRAFT_META_KEY);
          if (savedSource) setSourceText(savedSource);
          if (savedMeta) {
            try { setMetadata(JSON.parse(savedMeta)); } catch (e) {}
          }
          
          // Start elapsed timer
          extractionTimer.current = setInterval(() => {
            const elapsed = Date.now() - extractionStartTime.current;
            setExtractionElapsed(elapsed);
          }, 500);
          
          // Reconnect to job polling
          startJobPolling(savedJobId);
          return;
        }
        
        // Recovery: Check if there's a draft from a crashed extraction
        const wasExtracting = localStorage.getItem(DRAFT_EXTRACTING_KEY);
        const savedSource = localStorage.getItem(DRAFT_SOURCE_KEY);
        const savedMeta = localStorage.getItem(DRAFT_META_KEY);
        
        if (wasExtracting === "true" && savedSource) {
          console.log("[Recovery] Found draft source text from interrupted extraction");
          setSourceText(savedSource);
          if (savedMeta) {
            try {
              setMetadata(JSON.parse(savedMeta));
            } catch (e) {}
          }
          setExtractionStatus("failed");
          setExtractionError("Previous extraction was interrupted. Your source text has been recovered. You can try again.");
          localStorage.removeItem(DRAFT_EXTRACTING_KEY);
        }
    };
    load();
  }, []);

  // Cleanup extraction timer, worker, and polling on unmount
  useEffect(() => {
    return () => {
      if (extractionTimer.current) {
        clearInterval(extractionTimer.current);
      }
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  // Keep sourceTextRef in sync with sourceText
  useEffect(() => {
    sourceTextRef.current = sourceText;
  }, [sourceText]);

  const EXTRACTION_TIMEOUT_MS = 180000;
  const LARGE_DOC_THRESHOLD = 50000;

  const handleExtract = async () => {
    if (isExtracting) return;
    
    sourceTextRef.current = sourceText;
    const charCount = sourceText.length;
    const isLargeDoc = charCount > LARGE_DOC_THRESHOLD;
    const useServerJob = charCount > SERVER_JOB_THRESHOLD;
    
    console.log(`[Extraction] Starting extraction of ${charCount} characters (server=${useServerJob}) at ${new Date().toISOString()}`);
    
    // PERSIST before extraction - survives page refresh
    localStorage.setItem(DRAFT_SOURCE_KEY, sourceText);
    localStorage.setItem(DRAFT_META_KEY, JSON.stringify(metadata));
    localStorage.setItem(DRAFT_EXTRACTING_KEY, "true");
    
    setIsExtracting(true);
    setExtractionStatus("running");
    setExtractionError(null);
    setExtractionElapsed(0);
    setExtractionPhase(useServerJob ? "Submitting to server..." : (isLargeDoc ? "Preparing large document..." : "Starting..."));
    setExtractionProgress(0);
    extractionStartTime.current = Date.now();
    
    // Clear any existing timer
    if (extractionTimer.current) {
      clearInterval(extractionTimer.current);
    }
    
    // Start elapsed time tracker
    extractionTimer.current = setInterval(() => {
      const elapsed = Date.now() - extractionStartTime.current;
      setExtractionElapsed(elapsed);
      
      // Watchdog: Check for stalled server job
      if (serverJobId && lastHeartbeat > 0) {
        const timeSinceHeartbeat = Date.now() - lastHeartbeat;
        if (timeSinceHeartbeat > STALL_THRESHOLD_MS) {
          setExtractionPhase("Connection stalled - retrying...");
        }
      }
      
      // Timeout (only for worker mode - server jobs have their own timeout)
      // Use ref to avoid stale closure issue
      if (!isServerJobRef.current && elapsed > EXTRACTION_TIMEOUT_MS) {
        console.error("[Extraction] Timeout after", elapsed, "ms");
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
        setExtractionStatus("timeout");
        setExtractionError("Extraction timed out after 3 minutes. Your text has been saved - try a smaller section.");
        setIsExtracting(false);
        localStorage.removeItem(DRAFT_EXTRACTING_KEY);
        if (extractionTimer.current) clearInterval(extractionTimer.current);
      }
    }, 500);
    
    // USE SERVER JOB for large documents
    if (useServerJob) {
      isServerJobRef.current = true;
      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceText,
            metadata,
            options: extractOptions
          })
        });
        
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || "Failed to create server job");
        }
        
        const job = await res.json();
        console.log(`[Server Job] Created job ${job.job_id}`);
        
        // Persist job ID for refresh recovery
        localStorage.setItem(JOB_ID_KEY, job.job_id);
        
        // Start polling
        startJobPolling(job.job_id);
        return;
      } catch (err: any) {
        console.error("[Server Job] Creation failed:", err);
        setExtractionStatus("failed");
        setExtractionError("Failed to start server job: " + err.message);
        setIsExtracting(false);
        if (extractionTimer.current) clearInterval(extractionTimer.current);
        localStorage.removeItem(DRAFT_EXTRACTING_KEY);
        return;
      }
    }
    
    // USE WEB WORKER for smaller documents
    isServerJobRef.current = false;
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    
    const worker = new ExtractionWorker();
    workerRef.current = worker;
    
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data;
      
      if (msg.type === 'progress') {
        setExtractionPhase(msg.phase);
        setExtractionProgress(msg.percent);
        console.log(`[Extraction] Progress: ${msg.phase} (${msg.percent}%)`);
      }
      
      if (msg.type === 'result') {
        if (extractionTimer.current) clearInterval(extractionTimer.current);
        worker.terminate();
        workerRef.current = null;
        
        localStorage.removeItem(DRAFT_SOURCE_KEY);
        localStorage.removeItem(DRAFT_META_KEY);
        localStorage.removeItem(DRAFT_EXTRACTING_KEY);
        
        console.log(`[Extraction] Pack created in ${msg.processingTimeMs}ms with ${msg.pack.items.entities.length} entities`);
        
        setPack(msg.pack);
        setStep("extract");
        setExtractionStatus("completed");
        setIsExtracting(false);
      }
      
      if (msg.type === 'error') {
        if (extractionTimer.current) clearInterval(extractionTimer.current);
        worker.terminate();
        workerRef.current = null;
        
        console.error("[Extraction Error]", msg.message);
        setExtractionStatus("failed");
        setExtractionError(msg.message || "Unknown error. Your source text has been saved.");
        setExtractionPhase("");
        setIsExtracting(false);
        localStorage.removeItem(DRAFT_EXTRACTING_KEY);
      }
    };
    
    worker.onerror = (error) => {
      if (extractionTimer.current) clearInterval(extractionTimer.current);
      worker.terminate();
      workerRef.current = null;
      
      console.error("[Extraction Worker Error]", error);
      setExtractionStatus("failed");
      setExtractionError("Worker error: " + (error.message || "Unknown error. Your source text has been saved."));
      setExtractionPhase("");
      setIsExtracting(false);
      localStorage.removeItem(DRAFT_EXTRACTING_KEY);
    };
    
    const request: ExtractRequest = {
      type: 'extract',
      text: sourceText,
      options: extractOptions,
      metadata
    };
    
    worker.postMessage(request);
    
    if (isLargeDoc) {
      console.log(`[Extraction] Large document detected (${charCount} chars). Using Web Worker for non-blocking extraction.`);
    }
  };

  const handleSave = async () => {
    if (pack) {
      setStorageStatus("saving");
      const existing = savedPacks.find(p => isExtractPack(p) ? p.pack_id === pack.pack_id : p.packId === pack.pack_id);
      
      try {
          const newSaved = existing 
            ? savedPacks.map(p => {
                const pId = isExtractPack(p) ? p.pack_id : p.packId;
                return pId === pack.pack_id ? pack : p;
            })
            : [...savedPacks, pack as AnyPack];
            
          setSavedPacks(newSaved);
          debouncedSave({ packs: newSaved }, setStorageStatus);

          if (existing) {
             alert(`Pack updated (Snapshot ${pack.pack_id.slice(0, 8)})`);
          } else {
             alert(`New Snapshot Saved (ID: ${pack.pack_id.slice(0, 8)})`);
          }
      } catch (e) {
          console.error(e);
          setStorageStatus("error");
          alert("Failed to save to disk.");
      }
    }
  };

  const [, setLocation] = useLocation();

  const handlePromoteToDossier = (extractPack: LanternPack) => {
      const subjectName = prompt("Enter Subject Name for Dossier:", extractPack.source.title || "New Subject");
      if (!subjectName) return;

      const dossier = createDossierFromExtract(extractPack, { subjectName });
      
      const newSaved = [...savedPacks, dossier as AnyPack];
      setSavedPacks(newSaved);
      debouncedSave({ packs: newSaved }, setStorageStatus);
      
      setLocation(`/dossier/${dossier.packId}`);
  };

  const handleLoadDossier = (packId: string) => {
      setLocation(`/dossier/${packId}`);
  };

  const displayedPacks = filterSourceHash 
    ? savedPacks.filter(p => {
        if ("hashes" in p) {
            return p.hashes.source_text_sha256 === filterSourceHash;
        }
        return false;
    })
    : savedPacks;

  const reset = () => {
    setStep("input");
    setPack(null);
    setSourceText("");
    setMetadata({ title: "", author: "", publisher: "", url: "", published_at: "", source_type: "News" });
    setDiffMode(false);
    setDiffResult(null);
  };

  const toggleItem = (category: "entities" | "quotes" | "metrics" | "timeline", id: string) => {
    if (!pack) return;
    const updated = { ...pack };
    const items = updated.items[category] as any[];
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      items[idx] = { ...items[idx], included: !items[idx].included };
    }
    setPack(updated);
  };

  const handleLoadPack = (p: LanternPack) => {
    setPack(p);
    setStep("extract");
  };

  const handleCompare = (other: LanternPack) => {
    if (!pack) return;
    const diff = diffPacks(pack, other);
    setDiffResult(diff);
    setDiffMode(true);
  };

  const downloadJSON = () => {
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lantern_pack_${pack.pack_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = async () => {
    if (!pack) {
      alert("No pack to export");
      return;
    }
    
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      let y = 20;
      
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("LANTERN EXTRACT", 20, y);
      y += 10;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("Audit Artifact - Not Legal Advice", 20, y);
      y += 8;
      
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text("This document is a machine-generated extraction summary for investigative review.", 20, y);
      y += 5;
      pdf.text("It does not constitute legal advice, expert opinion, or verified fact.", 20, y);
      pdf.setTextColor(0);
      y += 10;
      
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.5);
      pdf.line(20, y, pageWidth - 20, y);
      y += 12;
      
      const trustInfo = pack.trust || { pack_confidence: 0, confidence_threshold: 0.5, sanitation_pass: false, schema_version: pack.schema, confidence_model: 'heuristic' };
      const packConfPercent = Math.round(trustInfo.pack_confidence * 100);
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text("Pack ID:", 20, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(pack.pack_id, 45, y);
      pdf.setFont("helvetica", "bold");
      pdf.text("Confidence:", 120, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${packConfPercent}%`, 150, y);
      y += 8;
      
      pdf.setFont("helvetica", "bold");
      pdf.text("Source:", 20, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(pack.source.title || "Untitled", 45, y);
      y += 6;
      pdf.text(`${pack.source.source_type} - ${pack.source.published_at || "No date"}`, 45, y);
      y += 8;
      
      pdf.setFont("helvetica", "bold");
      pdf.text("Sanitation:", 20, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(trustInfo.sanitation_pass ? "PASSED" : "NOT APPLIED", 50, y);
      pdf.setFont("helvetica", "bold");
      pdf.text("Threshold:", 90, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${Math.round(trustInfo.confidence_threshold * 100)}%`, 120, y);
      y += 12;
      
      pdf.setDrawColor(180);
      pdf.setLineWidth(0.2);
      pdf.line(20, y, pageWidth - 20, y);
      y += 10;
      
      pdf.setFont("helvetica", "bold");
      pdf.text("Extraction Summary:", 20, y);
      y += 8;
      
      const confThreshold = trustInfo.confidence_threshold || 0.5;
      const entities = pack.items.entities.filter((e: any) => e.included && (e.confidence_score || e.confidence) >= confThreshold).length;
      const quotes = pack.items.quotes.filter((q: any) => q.included).length;
      const metrics = pack.items.metrics.filter((m: any) => m.included).length;
      const timeline = pack.items.timeline.filter((t: any) => t.included).length;
      const excludedEntities = pack.items.entities.filter((e: any) => !e.included || (e.confidence_score || e.confidence) < confThreshold).length;
      
      pdf.setFont("helvetica", "normal");
      pdf.text(`Entities (above threshold): ${entities}`, 25, y); y += 5;
      pdf.text(`Entities (excluded): ${excludedEntities}`, 25, y); y += 5;
      pdf.text(`Quotes: ${quotes}`, 25, y); y += 5;
      pdf.text(`Metrics: ${metrics}`, 25, y); y += 5;
      pdf.text(`Timeline Events: ${timeline}`, 25, y); y += 12;
      
      if (entities > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.text("Entities (Sanitized, Above Threshold):", 20, y);
        y += 7;
        pdf.setFont("helvetica", "normal");
        const filteredEntities = pack.items.entities.filter((e: any) => 
          e.included && (e.confidence_score || e.confidence) >= confThreshold
        );
        for (const entity of filteredEntities.slice(0, 25)) {
          if (y > 270) { pdf.addPage(); y = 20; }
          const confScore = Math.round((entity.confidence_score || entity.confidence) * 100);
          const text = `- ${entity.text} (${entity.type}) [${confScore}%]`;
          pdf.text(text.substring(0, 85), 25, y);
          y += 5;
        }
        if (filteredEntities.length > 25) {
          pdf.text(`... and ${filteredEntities.length - 25} more`, 25, y);
          y += 5;
        }
        y += 8;
      }
      
      if (quotes > 0) {
        if (y > 245) { pdf.addPage(); y = 20; }
        pdf.setFont("helvetica", "bold");
        pdf.text("Quotes:", 20, y);
        y += 7;
        pdf.setFont("helvetica", "normal");
        for (const quote of pack.items.quotes.filter((q: any) => q.included).slice(0, 8)) {
          if (y > 260) { pdf.addPage(); y = 20; }
          const text = `"${quote.quote.substring(0, 90)}${quote.quote.length > 90 ? '...' : ''}"`;
          const lines = pdf.splitTextToSize(text, pageWidth - 50);
          pdf.text(lines, 25, y);
          y += lines.length * 5 + 2;
        }
      }
      
      pdf.setFontSize(7);
      pdf.setTextColor(100);
      pdf.text(`Lantern Extract v${pack.engine.version} | Schema: ${trustInfo.schema_version || pack.schema}`, 20, 282);
      pdf.text(`Generated: ${new Date().toISOString().split('T')[0]} | Confidence Model: ${trustInfo.confidence_model || 'heuristic'}`, 20, 286);
      pdf.setTextColor(0);
      
      pdf.save(`lantern_pack_${pack.pack_id.slice(0, 8)}.pdf`);
    } catch (err: any) {
      console.error("[PDF Export] Error:", err);
      alert("PDF export failed: " + err.message);
    }
  };

  const runQualityTests = async () => {
    setRunningTests(true);
    const reports: QualityReport[] = [];
    
    for (const fixture of fixtures as any[]) {
      const result = extract(fixture.source_text, { mode: "balanced" });
      const allItems = [...result.items.entities, ...result.items.quotes, ...result.items.metrics, ...result.items.timeline];
      const expectedItems = fixture.expected || [];
      const matchFn = (a: any, b: any) => a.text === b.text || a.quote === b.quote || a.value === b.value;
      const scoreResult = scoreExtraction(allItems, expectedItems, matchFn);
      const report: QualityReport = {
        fixture_id: fixture.id,
        score: scoreResult.metrics.f1,
        details: { expected: scoreResult.expected, actual: scoreResult.actual, matches: scoreResult.matches, false_positives: scoreResult.false_positives, false_negatives: scoreResult.false_negatives },
        metrics: scoreResult.metrics,
        failures: []
      };
      reports.push(report);
    }
    
    setQualityReports(reports);
    
    // Determinism check
    const firstRun = extract((fixtures as any[])[0].source_text, { mode: "balanced" });
    let deterministic = true;
    for (let i = 0; i < 5; i++) {
      const run = extract((fixtures as any[])[0].source_text, { mode: "balanced" });
      if (JSON.stringify(run.items) !== JSON.stringify(firstRun.items)) {
        deterministic = false;
        break;
      }
    }
    setDeterminismStatus(deterministic ? "pass" : "fail");
    
    // Provenance check
    const allHaveProvenance = firstRun.items.entities.every(e => e.provenance?.sentence);
    setProvenanceStatus(allHaveProvenance ? "pass" : "fail");
    
    // Mode validation
    const modes: ("conservative" | "balanced" | "broad")[] = ["conservative", "balanced", "broad"];
    const counts = modes.map(m => extract((fixtures as any[])[0].source_text, { mode: m }).items.entities.length);
    const warnings: string[] = [];
    if (counts[0] > counts[1]) warnings.push("Conservative > Balanced");
    if (counts[1] > counts[2]) warnings.push("Balanced > Broad");
    setModeValidation({ pass: warnings.length === 0, warnings });
    
    setRunningTests(false);
  };

  // Quality Dashboard
  if (step === "quality") {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 md:p-12 font-sans">
        <div className="max-w-4xl mx-auto space-y-8">
          <header className="border-b border-border pb-6 flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-mono font-bold">Quality Dashboard</h1>
              <p className="text-xs font-mono text-muted-foreground mt-1">Engine v0.1.5 • 5 Fixtures</p>
            </div>
            <div className="flex gap-2">
               <Button onClick={runQualityTests} disabled={runningTests} className="font-mono bg-cyan-500 text-black hover:bg-cyan-400">
                 <Play className="w-4 h-4 mr-2" /> {runningTests ? "Running..." : "Run Full Quality Suite"}
               </Button>
               <Button variant="ghost" onClick={() => setStep("input")}>Close</Button>
            </div>
          </header>

          {/* Hard Gates Panel */}
          {qualityReports.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className={cn("p-3 rounded border text-center", determinismStatus === "pass" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20")}>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Determinism (5x Run)</p>
                    <div className="flex items-center justify-center gap-2 font-bold font-mono">
                        {determinismStatus === "pass" ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                        {determinismStatus.toUpperCase()}
                    </div>
                </div>
                <div className={cn("p-3 rounded border text-center", provenanceStatus === "pass" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20")}>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Provenance Integrity</p>
                    <div className="flex items-center justify-center gap-2 font-bold font-mono">
                        {provenanceStatus === "pass" ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
                        {provenanceStatus.toUpperCase()}
                    </div>
                </div>
                <div className={cn("p-3 rounded border text-center", modeValidation?.pass ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20")}>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">Cross-Mode Logic</p>
                    <div className="flex items-center justify-center gap-2 font-bold font-mono">
                        {modeValidation?.pass ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        {modeValidation?.pass ? "PASS" : "WARN"}
                    </div>
                </div>
            </div>
          )}

          <div className="grid gap-4">
            {qualityReports.length === 0 && !runningTests && <p className="text-muted-foreground font-mono">No tests run yet.</p>}
            
            {qualityReports.map(report => (
              <Card key={report.fixture_id} className="border-border bg-card/50">
                <CardHeader className="py-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-mono">{report.fixture_id}</CardTitle>
                    <Badge variant={report.score === 1 ? "default" : report.score > 0.8 ? "secondary" : "destructive"} className="font-mono">
                      F1: {report.metrics.f1.toFixed(2)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-3 text-xs font-mono grid grid-cols-4 gap-4">
                   <div className="flex flex-col">
                     <span className="text-muted-foreground uppercase text-[10px]">Precision</span>
                     <span className="font-bold text-lg">{report.metrics.precision.toFixed(2)}</span>
                   </div>
                   <div className="flex flex-col">
                     <span className="text-muted-foreground uppercase text-[10px]">Recall</span>
                     <span className="font-bold text-lg">{report.metrics.recall.toFixed(2)}</span>
                   </div>
                   <div className="flex flex-col">
                     <span className="text-muted-foreground uppercase text-[10px]">Matches</span>
                     <span className="text-emerald-500 font-bold">{report.details.matches} / {report.details.expected}</span>
                   </div>
                   <div className="flex flex-col">
                     <span className="text-muted-foreground uppercase text-[10px]">False Pos/Neg</span>
                     <div className="flex gap-2">
                       <span className="text-amber-500">+{report.details.false_positives}</span>
                       <span className="text-red-500">-{report.details.false_negatives}</span>
                     </div>
                   </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-12 font-sans selection:bg-cyan-500/30">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-border pb-6 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-mono font-bold tracking-tight">LANTERN<span className="text-cyan-500">_EXTRACT</span></h1>
            <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest mt-2">
              Structured Knowledge Extraction Engine
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep("quality")} className="font-mono text-xs uppercase">
              <Activity className="w-3 h-3 mr-2" /> Quality
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSaved(true)} className="font-mono text-xs uppercase">
              <FolderOpen className="w-3 h-3 mr-2" /> Library
            </Button>
            <Button variant="ghost" size="sm" onClick={reset} className="font-mono text-xs uppercase text-muted-foreground hover:text-foreground">
              <RefreshCw className="w-3 h-3 mr-2" /> Reset
            </Button>
          </div>
        </header>

        {/* ... (Progress, Input, Extract Views - largely unchanged except Diff alerts) */}
        
        {/* DIFF ALERT */}
        {diffMode && diffResult && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-md mb-6 animate-in slide-in-from-top-2">
             <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                   <GitCompare className="w-4 h-4 text-amber-500" />
                   <h3 className="text-sm font-bold font-mono text-amber-500 uppercase">Comparison Mode</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setDiffMode(false); setDiffResult(null); }} className="h-6 text-[10px]">Exit Compare</Button>
             </div>
             <div className="grid grid-cols-4 gap-4 text-xs font-mono">
                <div className="bg-background/50 p-2 rounded border border-emerald-500/30">
                   <p className="text-emerald-500 font-bold mb-1">+{diffResult.stats.added_count} Added</p>
                   {diffResult.added.slice(0,3).map((d, i) => (
                      <div key={i} className="truncate opacity-70">
                         {d.type === 'entities' ? d.item.text : d.type === 'quotes' ? d.item.quote.slice(0,20) : 'Item'}
                      </div>
                   ))}
                </div>
                <div className="bg-background/50 p-2 rounded border border-red-500/30">
                   <p className="text-red-500 font-bold mb-1">-{diffResult.stats.removed_count} Removed</p>
                   {diffResult.removed.slice(0,3).map((d, i) => (
                      <div key={i} className="truncate opacity-70">
                         {d.type === 'entities' ? d.item.text : d.type === 'quotes' ? d.item.quote.slice(0,20) : 'Item'}
                      </div>
                   ))}
                </div>
                <div className="bg-background/50 p-2 rounded border border-blue-500/30">
                   <p className="text-blue-500 font-bold mb-1">~{diffResult.stats.changed_count} Changed</p>
                   {diffResult.changed.slice(0,3).map((d, i) => (
                      <div key={i} className="truncate opacity-70 flex items-center gap-1">
                         <span>{d.type === 'entities' ? (d.from as any).text : 'Item'}</span>
                         <ArrowRight className="w-2 h-2" />
                         <span>{d.type === 'entities' ? (d.to as any).text : 'Item'}</span>
                      </div>
                   ))}
                </div>
                <div className="bg-background/50 p-2 rounded border border-muted">
                   <p className="text-muted-foreground font-bold mb-1">{diffResult.stats.common_count} Unchanged</p>
                </div>
             </div>
          </div>
        )}

        {/* Progress */}
        <div className="flex items-center gap-4 text-sm font-mono uppercase text-muted-foreground">
          <span className={step === "input" ? "text-foreground font-bold" : ""}>1. Source</span>
          <ChevronRight className="w-4 h-4" />
          <span className={step === "extract" ? "text-foreground font-bold" : ""}>2. Extraction</span>
          <ChevronRight className="w-4 h-4" />
          <span className={step === "export" ? "text-foreground font-bold" : ""}>3. Pack Export</span>
        </div>

        {/* STEP 1: INPUT */}
        {step === "input" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-2">
            <Card className="lg:col-span-2 border-border bg-card/50 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-mono text-lg">Source Text</CardTitle>
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-muted-foreground" />
                  <Select 
                    value={extractOptions.mode} 
                    onValueChange={(val: any) => setExtractOptions({...extractOptions, mode: val})}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs font-mono uppercase">
                      <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="broad">Broad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Textarea 
                    placeholder="Paste article text here or upload a .txt/.md file..." 
                    className="min-h-[400px] font-mono text-sm bg-background/50 resize-y pr-12"
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    data-testid="textarea-source"
                  />
                  <div className="absolute top-2 right-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".txt,.md,.pdf,application/pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploadingFile}
                        data-testid="input-file-upload"
                      />
                      <div className={cn(
                        "p-2 rounded-md border border-border bg-background/80 hover:bg-muted transition-colors",
                        uploadingFile && "opacity-50 cursor-not-allowed"
                      )}>
                        {uploadingFile ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Paperclip className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        )}
                      </div>
                    </label>
                  </div>
                </div>
                {uploadError && (
                  <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 px-3 py-2 rounded-md" data-testid="text-upload-error">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {uploadError}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Supports .txt, .md (max 5MB) and PDF files (max 10MB, text-based only).
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card/50 backdrop-blur-sm h-fit">
              <CardHeader>
                <CardTitle className="font-mono text-lg">Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Title</Label>
                  <Input value={metadata.title} onChange={(e) => setMetadata({...metadata, title: e.target.value})} className="bg-background/50 font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Author</Label>
                  <Input value={metadata.author} onChange={(e) => setMetadata({...metadata, author: e.target.value})} className="bg-background/50 font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Publisher</Label>
                  <Input value={metadata.publisher} onChange={(e) => setMetadata({...metadata, publisher: e.target.value})} className="bg-background/50 font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Source Type</Label>
                  <select 
                    className="w-full h-10 rounded-md border border-input bg-background/50 px-3 py-2 text-sm font-mono"
                    value={metadata.source_type}
                    onChange={(e) => setMetadata({...metadata, source_type: e.target.value})}
                  >
                    <option>News</option>
                    <option>Blog</option>
                    <option>Academic</option>
                    <option>Government</option>
                    <option>Social</option>
                  </select>
                </div>
                {sourceText.length > 50000 && !isExtracting && extractionStatus === "idle" && (
                  <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-md">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs font-mono text-amber-500">
                        <p className="font-semibold">Large Document ({(sourceText.length / 1000).toFixed(0)}K chars)</p>
                        <p className="mt-1 opacity-80">Extraction may take 1-3 minutes. Your text will be saved automatically if interrupted.</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <Button 
                  disabled={!sourceText || isExtracting} 
                  onClick={handleExtract}
                  className="w-full mt-4 font-mono uppercase bg-cyan-500 text-black hover:bg-cyan-400"
                  data-testid="button-run-extraction"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Extracting... ({Math.floor(extractionElapsed / 1000)}s)
                    </>
                  ) : (
                    "Run Extraction"
                  )}
                </Button>
                
                {isExtracting && (
                  <div className="mt-3 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-md">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs font-mono text-cyan-500">
                        <span>{extractionPhase || "Processing..."}</span>
                        <span>{extractionProgress}%</span>
                      </div>
                      <div className="h-1.5 bg-cyan-500/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-cyan-500 transition-all duration-300"
                          style={{ width: `${extractionProgress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-cyan-500/60">
                        <span>Elapsed: {Math.floor(extractionElapsed / 1000)}s</span>
                        <span>{sourceText.length.toLocaleString()} chars</span>
                      </div>
                      {serverJobId && (
                        <div className="text-[10px] font-mono text-cyan-500/40 flex justify-between">
                          <span>Server Job</span>
                          <span>{serverJobId.slice(0, 8)}</span>
                        </div>
                      )}
                      {lastHeartbeat > 0 && (
                        <div className="text-[10px] font-mono text-cyan-500/40">
                          Last update: {Math.round((Date.now() - lastHeartbeat) / 1000)}s ago
                        </div>
                      )}
                      {isStalled && serverJobId && (
                        <div className="mt-2 p-2 bg-amber-500/20 border border-amber-500/40 rounded-md">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-[10px] font-mono text-amber-500">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Job appears stalled - no progress for 30s</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] border-amber-500/50 text-amber-500 hover:bg-amber-500/20"
                              onClick={cancelStalledJob}
                              data-testid="button-cancel-stalled"
                            >
                              Cancel Job
                            </Button>
                          </div>
                        </div>
                      )}
                      {serverJobId && !isStalled ? (
                        <p className="text-[10px] font-mono text-emerald-500">
                          Durable mode - safe to refresh. Job will resume automatically.
                        </p>
                      ) : !serverJobId && extractionElapsed > 30000 ? (
                        <p className="text-[10px] font-mono text-yellow-500">
                          Large document - do not refresh. Your text is saved for recovery.
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
                
                {(extractionStatus === "failed" || extractionStatus === "timeout") && !isExtracting && (
                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-md">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs font-mono text-red-500">
                        <p className="font-semibold">{extractionStatus === "timeout" ? "Extraction Timeout" : "Extraction Issue"}</p>
                        <p className="mt-1 opacity-80">{extractionError}</p>
                        <p className="mt-2 opacity-60">Your source text is preserved. You can try again.</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {extractionStatus === "completed" && step === "input" && (
                  <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md">
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs font-mono text-emerald-500">
                        <p className="font-semibold">Extraction Completed</p>
                        <p className="mt-1 opacity-80">Processed in {Math.floor(extractionElapsed / 1000)}s</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP 2: EXTRACT */}
        {step === "extract" && pack && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-250px)] animate-in fade-in slide-in-from-bottom-2">
            <div className="lg:col-span-3 h-full flex flex-col">
              <Tabs defaultValue="entities" className="h-full flex flex-col">
                <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent p-0 mb-4 gap-6">
                  <TabsTrigger value="entities" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-cyan-500 data-[state=active]:shadow-none rounded-none px-0 pb-2 font-mono uppercase text-xs gap-2">
                    <Users className="w-4 h-4" /> Entities <Badge variant="secondary" className="ml-1 text-[10px]">{pack.items.entities.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="quotes" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-cyan-500 data-[state=active]:shadow-none rounded-none px-0 pb-2 font-mono uppercase text-xs gap-2">
                    <Quote className="w-4 h-4" /> Quotes <Badge variant="secondary" className="ml-1 text-[10px]">{pack.items.quotes.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="metrics" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-cyan-500 data-[state=active]:shadow-none rounded-none px-0 pb-2 font-mono uppercase text-xs gap-2">
                    <Hash className="w-4 h-4" /> Metrics <Badge variant="secondary" className="ml-1 text-[10px]">{pack.items.metrics.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-cyan-500 data-[state=active]:shadow-none rounded-none px-0 pb-2 font-mono uppercase text-xs gap-2">
                    <CalendarClock className="w-4 h-4" /> Timeline <Badge variant="secondary" className="ml-1 text-[10px]">{pack.items.timeline.length}</Badge>
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-hidden relative">
                  <ScrollArea className="h-full pr-4">
                    {/* Content with pagination for large datasets */}
                    <TabsContent value="entities" className="mt-0 space-y-4">
                      {(() => {
                        const items = pack.items.entities;
                        const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
                        const safePage = Math.min(entityPage, totalPages);
                        const start = (safePage - 1) * PAGE_SIZE;
                        const pageItems = items.slice(start, start + PAGE_SIZE);
                        return (
                          <>
                            {items.length > PAGE_SIZE && (
                              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground bg-muted/30 p-2 rounded mb-2">
                                <div className="flex items-center gap-2">
                                  <span>Page {safePage} of {totalPages} ({items.length.toLocaleString()} total)</span>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" disabled={safePage <= 1} onClick={() => setEntityPage(1)} className="h-6 px-1" title="First">
                                    <ChevronLeft className="w-3 h-3" /><ChevronLeft className="w-3 h-3 -ml-2" />
                                  </Button>
                                  <Button variant="ghost" size="sm" disabled={safePage <= 1} onClick={() => setEntityPage(p => Math.max(1, p - 1))} className="h-6 px-2">
                                    <ChevronLeft className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" disabled={safePage >= totalPages} onClick={() => setEntityPage(p => Math.min(totalPages, p + 1))} className="h-6 px-2">
                                    <ChevronRight className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" disabled={safePage >= totalPages} onClick={() => setEntityPage(totalPages)} className="h-6 px-1" title="Last">
                                    <ChevronRight className="w-3 h-3" /><ChevronRight className="w-3 h-3 -ml-2" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            {pageItems.map((item) => {
                              const confScore = Math.round((item.confidence_score || item.confidence) * 100);
                              const confColor = confScore >= 70 ? "text-emerald-500" : confScore >= 50 ? "text-yellow-500" : "text-red-500";
                              return (
                                <ExtractionCard 
                                  key={item.id} 
                                  item={item} 
                                  onToggle={() => toggleItem("entities", item.id)}
                                  icon={<Users className="w-4 h-4 text-cyan-500" />}
                                  title={item.text}
                                  subtitle={`${item.type}${item.entity_class && item.entity_class !== item.type ? ` (${item.entity_class})` : ''}`}
                                  meta={
                                    <div className="flex gap-1 items-center">
                                      <Badge variant="outline" className={`text-[9px] font-mono border-current ${confColor}`}>{confScore}%</Badge>
                                      <Badge variant="outline" className="text-[9px] font-mono border-cyan-500/20 text-cyan-500">{item.canonical_family_id?.slice(0,6)}</Badge>
                                    </div>
                                  }
                                />
                              );
                            })}
                          </>
                        );
                      })()}
                    </TabsContent>
                    <TabsContent value="quotes" className="mt-0 space-y-4">
                      {(() => {
                        const items = pack.items.quotes;
                        const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
                        const safePage = Math.min(quotePage, totalPages);
                        const start = (safePage - 1) * PAGE_SIZE;
                        const pageItems = items.slice(start, start + PAGE_SIZE);
                        return (
                          <>
                            {items.length > PAGE_SIZE && (
                              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground bg-muted/30 p-2 rounded mb-2">
                                <div className="flex items-center gap-2">
                                  <span>Page {safePage} of {totalPages} ({items.length.toLocaleString()} total)</span>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" disabled={safePage <= 1} onClick={() => setQuotePage(1)} className="h-6 px-1" title="First">
                                    <ChevronLeft className="w-3 h-3" /><ChevronLeft className="w-3 h-3 -ml-2" />
                                  </Button>
                                  <Button variant="ghost" size="sm" disabled={safePage <= 1} onClick={() => setQuotePage(p => Math.max(1, p - 1))} className="h-6 px-2">
                                    <ChevronLeft className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" disabled={safePage >= totalPages} onClick={() => setQuotePage(p => Math.min(totalPages, p + 1))} className="h-6 px-2">
                                    <ChevronRight className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" disabled={safePage >= totalPages} onClick={() => setQuotePage(totalPages)} className="h-6 px-1" title="Last">
                                    <ChevronRight className="w-3 h-3" /><ChevronRight className="w-3 h-3 -ml-2" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            {pageItems.map((item) => (
                              <ExtractionCard 
                                key={item.id} 
                                item={item} 
                                onToggle={() => toggleItem("quotes", item.id)}
                                icon={<Quote className="w-4 h-4 text-amber-500" />}
                                title={`"${item.quote.slice(0, 200)}${item.quote.length > 200 ? '...' : ''}"`}
                                subtitle={item.speaker || (item.speaker_candidates ? `Candidates: ${item.speaker_candidates.join(", ")}` : "Unknown Speaker")}
                              />
                            ))}
                          </>
                        );
                      })()}
                    </TabsContent>
                    <TabsContent value="metrics" className="mt-0 space-y-4">
                      {(() => {
                        const items = pack.items.metrics;
                        const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
                        const safePage = Math.min(metricPage, totalPages);
                        const start = (safePage - 1) * PAGE_SIZE;
                        const pageItems = items.slice(start, start + PAGE_SIZE);
                        return (
                          <>
                            {items.length > PAGE_SIZE && (
                              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground bg-muted/30 p-2 rounded mb-2">
                                <div className="flex items-center gap-2">
                                  <span>Page {safePage} of {totalPages} ({items.length.toLocaleString()} total)</span>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" disabled={safePage <= 1} onClick={() => setMetricPage(1)} className="h-6 px-1" title="First">
                                    <ChevronLeft className="w-3 h-3" /><ChevronLeft className="w-3 h-3 -ml-2" />
                                  </Button>
                                  <Button variant="ghost" size="sm" disabled={safePage <= 1} onClick={() => setMetricPage(p => Math.max(1, p - 1))} className="h-6 px-2">
                                    <ChevronLeft className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" disabled={safePage >= totalPages} onClick={() => setMetricPage(p => Math.min(totalPages, p + 1))} className="h-6 px-2">
                                    <ChevronRight className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" disabled={safePage >= totalPages} onClick={() => setMetricPage(totalPages)} className="h-6 px-1" title="Last">
                                    <ChevronRight className="w-3 h-3" /><ChevronRight className="w-3 h-3 -ml-2" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            {pageItems.map((item) => (
                              <ExtractionCard 
                                key={item.id} 
                                item={item} 
                                onToggle={() => toggleItem("metrics", item.id)}
                                icon={<Hash className="w-4 h-4 text-emerald-500" />}
                                title={`${item.value} ${item.unit}`}
                                subtitle={item.metric_kind === "range" ? `Range: ${item.range_low} - ${item.range_high}` : item.parse_notes || "Extracted Metric"}
                                meta={
                                  <div className="flex gap-1">
                                    {item.qualifier && <Badge variant="outline" className="text-[9px] border-emerald-500/20 text-emerald-500">{item.qualifier}</Badge>}
                                    {item.metric_kind !== "scalar" && <Badge variant="outline" className="text-[9px] border-blue-500/20 text-blue-500">{item.metric_kind}</Badge>}
                                  </div>
                                }
                              />
                            ))}
                          </>
                        );
                      })()}
                    </TabsContent>
                    <TabsContent value="timeline" className="mt-0 space-y-4">
                      {(() => {
                        const items = pack.items.timeline;
                        const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
                        const safePage = Math.min(timelinePage, totalPages);
                        const start = (safePage - 1) * PAGE_SIZE;
                        const pageItems = items.slice(start, start + PAGE_SIZE);
                        return (
                          <>
                            {items.length > PAGE_SIZE && (
                              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground bg-muted/30 p-2 rounded mb-2">
                                <div className="flex items-center gap-2">
                                  <span>Page {safePage} of {totalPages} ({items.length.toLocaleString()} total)</span>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" disabled={safePage <= 1} onClick={() => setTimelinePage(1)} className="h-6 px-1" title="First">
                                    <ChevronLeft className="w-3 h-3" /><ChevronLeft className="w-3 h-3 -ml-2" />
                                  </Button>
                                  <Button variant="ghost" size="sm" disabled={safePage <= 1} onClick={() => setTimelinePage(p => Math.max(1, p - 1))} className="h-6 px-2">
                                    <ChevronLeft className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" disabled={safePage >= totalPages} onClick={() => setTimelinePage(p => Math.min(totalPages, p + 1))} className="h-6 px-2">
                                    <ChevronRight className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" disabled={safePage >= totalPages} onClick={() => setTimelinePage(totalPages)} className="h-6 px-1" title="Last">
                                    <ChevronRight className="w-3 h-3" /><ChevronRight className="w-3 h-3 -ml-2" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            {pageItems.map((item) => (
                              <ExtractionCard 
                                key={item.id} 
                                item={item} 
                                onToggle={() => toggleItem("timeline", item.id)}
                                icon={<CalendarClock className="w-4 h-4 text-purple-500" />}
                                title={item.date}
                                subtitle={item.event}
                                meta={<Badge variant="outline" className="text-[9px] border-purple-500/20 text-purple-500">{item.confidence > 0.8 ? "HIGH" : "MED"}</Badge>}
                              />
                            ))}
                          </>
                        );
                      })()}
                    </TabsContent>
                  </ScrollArea>
                </div>
              </Tabs>
            </div>

            {/* Sidebar Controls */}
            <div className="space-y-6">
              <Card className="border-border bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="font-mono text-sm uppercase">Pack Controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-muted p-2 rounded">
                      <div className="text-xl font-bold font-mono">{pack.items.entities.filter((e: any) => e.included).length + pack.items.quotes.filter((q: any) => q.included).length + pack.items.metrics.filter((m: any) => m.included).length}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">Items</div>
                    </div>
                    <div className="bg-muted p-2 rounded">
                      <div className="text-xl font-bold font-mono">{Math.round((pack.trust?.pack_confidence || 0) * 100)}%</div>
                      <div className="text-[10px] uppercase text-muted-foreground">Confidence</div>
                    </div>
                  </div>
                  
                  <div className="text-[10px] font-mono text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Sanitation:</span>
                      <span className={pack.trust?.sanitation_pass ? "text-emerald-500" : "text-yellow-500"}>
                        {pack.trust?.sanitation_pass ? "PASSED" : "NOT APPLIED"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Denied:</span>
                      <span>{pack.stats.sanitation_denied || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Reclassified:</span>
                      <span>{pack.stats.sanitation_reclassified || 0}</span>
                    </div>
                  </div>
                  
                  <Button 
                    data-testid="button-save-snapshot"
                    onClick={handleSave} 
                    className="w-full font-mono uppercase bg-emerald-500 text-black hover:bg-emerald-400"
                  >
                    <Save className="w-4 h-4 mr-2" /> Save Snapshot
                  </Button>
                  <Button 
                    data-testid="button-export-json"
                    onClick={downloadJSON} 
                    variant="outline" 
                    className="w-full font-mono uppercase text-xs"
                  >
                    <Download className="w-3 h-3 mr-2" /> Export JSON
                  </Button>
                  <Button 
                    data-testid="button-export-pdf"
                    onClick={downloadPDF} 
                    variant="outline" 
                    className="w-full font-mono uppercase text-xs"
                  >
                    <FileText className="w-3 h-3 mr-2" /> Export PDF
                  </Button>
                </CardContent>
                <CardFooter>
                  <Button onClick={() => setStep("extract")} variant="ghost" className="w-full font-mono uppercase text-xs">
                    Back to Curation
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* PDF PREVIEW - Hidden but capturable for PDF export */}
            <div className="fixed left-[-9999px] top-0">
              <div 
                className="pdf-preview w-[595px] min-h-[842px] bg-white text-black p-12 shadow-xl flex flex-col relative" 
              >
                <div className="border-b-4 border-black pb-8 mb-8">
                  <h1 className="font-sans text-4xl font-bold tracking-tight mb-2">LANTERN<span className="text-cyan-600">_EXTRACT</span></h1>
                  <p className="font-mono text-sm text-zinc-500 uppercase tracking-widest">Visual Extraction Pack</p>
                </div>
                {pack ? (
                  <div className="space-y-6 text-sm">
                    <div>
                      <h2 className="font-mono text-xs uppercase font-bold text-zinc-500 mb-2">Pack ID</h2>
                      <p className="font-mono text-xs break-all">{pack.pack_id}</p>
                    </div>
                    <div>
                      <h2 className="font-mono text-xs uppercase font-bold text-zinc-500 mb-2">Source</h2>
                      <p className="font-medium">{pack.source.title || "Untitled"}</p>
                      <p className="text-xs text-zinc-500">{pack.source.source_type} • {pack.source.published_at || "No date"}</p>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-cyan-600">{pack.items.entities.filter((e: any) => e.included).length}</p>
                        <p className="text-[10px] uppercase font-mono text-zinc-500">Entities</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-emerald-600">{pack.items.quotes.filter((q: any) => q.included).length}</p>
                        <p className="text-[10px] uppercase font-mono text-zinc-500">Quotes</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-amber-600">{pack.items.metrics.filter((m: any) => m.included).length}</p>
                        <p className="text-[10px] uppercase font-mono text-zinc-500">Metrics</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-purple-600">{pack.items.timeline.filter((t: any) => t.included).length}</p>
                        <p className="text-[10px] uppercase font-mono text-zinc-500">Timeline</p>
                      </div>
                    </div>
                    <div className="border-t pt-4 mt-auto">
                      <p className="text-[10px] font-mono text-zinc-400">Generated by Lantern Extract • {new Date().toISOString().split('T')[0]}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground mt-20 font-mono italic">Preview Active</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ... (ExtractionCard and SectionHeader unchanged)
function ExtractionCard({ item, onToggle, icon, title, subtitle, meta }: { item: any, onToggle: () => void, icon: any, title: string, subtitle: string, meta?: any }) {
  return (
    <div className={cn(
      "p-4 border rounded-md transition-all",
      item.included 
        ? "bg-card border-border hover:border-cyan-500/50" 
        : "bg-muted/30 border-muted opacity-60 hover:opacity-100"
    )}>
      <div className="flex items-start gap-4">
        <div className="mt-1">{icon}</div>
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-sm leading-tight">{title}</p>
              <div className="flex items-center gap-2 mt-1">
                 <p className="text-xs text-muted-foreground font-mono uppercase">{subtitle}</p>
                 {meta}
              </div>
            </div>
            <Switch checked={item.included} onCheckedChange={onToggle} />
          </div>
          
          <div className="bg-muted/50 p-2 rounded text-[10px] text-muted-foreground font-mono leading-relaxed break-words">
            <span className="text-cyan-500 opacity-50 mr-2">OFS {item.provenance.start}-{item.provenance.end}:</span>
            "{item.provenance.sentence}"
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, count, color }: { title: string, count: number, color: string }) {
  if (count === 0) return null;
  return (
    <div className={`flex items-center gap-2 border-b ${color} pb-1 mb-3`}>
      <h3 className="font-mono text-xs uppercase font-bold text-black">{title}</h3>
      <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-600">{count}</span>
    </div>
  );
}

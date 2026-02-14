import { extract, computePackId, type ExtractionOptions, type LanternPack } from '../lib/lanternExtract';

export interface ExtractRequest {
  type: 'extract';
  text: string;
  options: ExtractionOptions;
  metadata: {
    title: string;
    author: string;
    publisher: string;
    url: string;
    published_at: string;
    source_type: string;
  };
}

export interface ProgressMessage {
  type: 'progress';
  phase: string;
  percent: number;
}

export interface ResultMessage {
  type: 'result';
  pack: LanternPack;
  processingTimeMs: number;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type WorkerMessage = ProgressMessage | ResultMessage | ErrorMessage;

self.onmessage = (event: MessageEvent<ExtractRequest>) => {
  if (event.data.type !== 'extract') return;
  
  const { text, options, metadata } = event.data;
  
  try {
    self.postMessage({ type: 'progress', phase: 'Starting extraction...', percent: 5 } as ProgressMessage);
    
    const startTime = performance.now();
    
    self.postMessage({ type: 'progress', phase: 'Processing text...', percent: 15 } as ProgressMessage);
    
    const { items, stats, stable_source_hash, trust } = extract(text, options);
    
    self.postMessage({ type: 'progress', phase: 'Building pack...', percent: 85 } as ProgressMessage);
    
    const initialPackWithoutId: Omit<LanternPack, 'pack_id' | 'hashes'> = {
      schema: "lantern.extract.pack.v1",
      engine: { name: "heuristic", version: "0.1.6-sanitized" },
      source: { ...metadata, retrieved_at: new Date().toISOString() },
      items,
      stats,
      trust
    };

    const packId = computePackId(initialPackWithoutId, stable_source_hash);
    const pack: LanternPack = {
      ...initialPackWithoutId,
      pack_id: packId,
      hashes: { source_text_sha256: stable_source_hash, pack_sha256: packId }
    };
    
    const processingTimeMs = Math.round(performance.now() - startTime);
    
    self.postMessage({ type: 'progress', phase: 'Complete', percent: 100 } as ProgressMessage);
    self.postMessage({ type: 'result', pack, processingTimeMs } as ResultMessage);
  } catch (err: any) {
    self.postMessage({ type: 'error', message: err?.message || 'Unknown extraction error' } as ErrorMessage);
  }
};

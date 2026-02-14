export type SourceRole = "PRIMARY" | "SECONDARY";

export type CorpusPurpose = 
  | "Litigation support" 
  | "Investigative journalism" 
  | "Compliance/Internal Review" 
  | "Research/Exploratory";

export interface Corpus {
  corpus_id: string;
  created_at: string;
  purpose: CorpusPurpose;
}

export interface CorpusSource {
  source_id: string;
  corpus_id: string;
  role: SourceRole;
  filename: string;
  uploaded_at: string;
  sha256_hex: string;
}

export interface CorpusSourcesResponse {
  corpus_id: string;
  sources: CorpusSource[];
}

export const CORPUS_PURPOSES: CorpusPurpose[] = [
  "Litigation support",
  "Investigative journalism",
  "Compliance/Internal Review",
  "Research/Exploratory"
];

export const SYSTEM_LIMITATIONS = [
  "It won't infer intent",
  "It won't draw legal conclusions",
  "It won't assign blame",
  "It won't speculate beyond the sources"
];

export interface AnchorProvenance {
  source_sha256_hex: string;
  source_id: string;
  page_index: number;
  page_ref: string;
  quote_start_char: number;
  quote_end_char: number;
  extractor: {
    name: "pdfjs-text-v1";
    version: "1.0.0";
  };
}

export interface AnchorRecord {
  id: string;
  corpus_id: string;
  source_id: string;
  quote: string;
  source_document: string;
  page_ref: string;
  section_ref?: string | null;
  timeline_date: string;
  provenance: AnchorProvenance;
}

export interface PageProof {
  source_id: string;
  page_index: number;
  page_text_sha256_hex: string;
  page_png_url: string;
  page_text?: string;
}

export interface AnchorProofPacket {
  anchor: AnchorRecord;
  page: PageProof;
  repro: {
    page_text_substring: string;
    substring_sha256_hex: string;
  };
}

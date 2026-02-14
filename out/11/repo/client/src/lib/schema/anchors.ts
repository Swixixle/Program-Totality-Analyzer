export interface Anchor {
  id: string;
  quote: string;
  source_document: string;
  page_ref: string;
  section_ref?: string | null;
  timeline_date: string;
}

export interface AnchorsResponse {
  anchors: Anchor[];
  missing_ids: string[];
}

export const MOCK_ANCHORS: Record<string, Anchor> = {
  "anchor-001": {
    id: "anchor-001",
    quote: "This Agreement is entered into as of March 15, 2024, by and between Party A and Party B.",
    source_document: "Master Services Agreement v2.1.pdf",
    page_ref: "p. 1",
    section_ref: "§1.1 Parties",
    timeline_date: "2024-03-15"
  },
  "anchor-002": {
    id: "anchor-002",
    quote: "Both parties hereby acknowledge receipt of this executed agreement and agree to be bound by its terms.",
    source_document: "Master Services Agreement v2.1.pdf",
    page_ref: "p. 12",
    section_ref: "Signature Block",
    timeline_date: "2024-03-15"
  },
  "anchor-003": {
    id: "anchor-003",
    quote: "Payment shall be due within thirty (30) days of invoice date. Late payments shall accrue interest at 1.5% per month.",
    source_document: "Master Services Agreement v2.1.pdf",
    page_ref: "p. 5",
    section_ref: "§4.2 Payment Terms",
    timeline_date: "2024-03-15"
  }
};

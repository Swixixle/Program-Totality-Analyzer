import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AnchorProvenance {
  source_sha256_hex: string;
  source_id: string;
  page_index: number;
  page_ref: string;
  quote_start_char: number;
  quote_end_char: number;
  extractor: {
    name: string;
    version: string;
  };
}

interface AnchorRecord {
  id: string;
  corpus_id: string;
  source_id: string;
  quote: string;
  source_document: string;
  page_ref: string;
  section_ref: string | null;
  timeline_date: string;
  provenance: AnchorProvenance;
}

interface PageProof {
  source_id: string;
  page_index: number;
  page_text_sha256_hex: string;
  page_png_url: string;
}

interface AnchorProofPacket {
  anchor: AnchorRecord;
  page: PageProof;
  repro: {
    page_text_substring: string;
    substring_sha256_hex: string;
  };
}

export default function AnchorProofPage() {
  const [, navigate] = useLocation();
  const [proof, setProof] = useState<AnchorProofPacket | null>(null);
  const [rawJson, setRawJson] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams(window.location.search);
  const anchorId = params.get("anchorId");

  useEffect(() => {
    if (!anchorId) {
      setError("Missing anchorId parameter");
      setLoading(false);
      return;
    }

    fetch(`/api/anchors/${anchorId}/proof`)
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => {
            throw new Error(data.message || "Failed to fetch proof");
          });
        }
        return res.json();
      })
      .then(data => {
        setProof(data);
        setRawJson(JSON.stringify(data, null, 2));
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [anchorId]);

  const copyProofJson = () => {
    navigator.clipboard.writeText(rawJson);
  };

  const copyAuditLine = () => {
    if (!proof) return;
    const line = `${proof.anchor.id}|${proof.anchor.provenance.source_id}|${proof.anchor.provenance.page_index}|${proof.anchor.provenance.quote_start_char}|${proof.anchor.provenance.quote_end_char}|${proof.page.page_text_sha256_hex}|${proof.repro.substring_sha256_hex}`;
    navigator.clipboard.writeText(line);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-muted-foreground">Loading proof...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Proof Unavailable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <Button className="mt-4" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!proof) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 flex gap-2">
        <Button variant="outline" onClick={() => window.history.back()}>
          Back
        </Button>
        <Button variant="outline" onClick={copyProofJson} data-testid="copy-proof-json">
          Copy Proof JSON
        </Button>
        <Button variant="outline" onClick={copyAuditLine} data-testid="copy-audit-line">
          Copy Audit Line
        </Button>
      </div>

      <h1 className="text-2xl font-bold mb-6">Anchor Extraction Proof</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Proof Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground w-40">Anchor ID</td>
                  <td className="py-2 font-mono" data-testid="proof-anchor-id">{proof.anchor.id}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Corpus ID</td>
                  <td className="py-2 font-mono" data-testid="proof-corpus-id">{proof.anchor.corpus_id}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Source ID</td>
                  <td className="py-2 font-mono" data-testid="proof-source-id">{proof.anchor.provenance.source_id}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Source SHA256</td>
                  <td className="py-2 font-mono text-xs break-all" data-testid="proof-source-sha256">{proof.anchor.provenance.source_sha256_hex}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Source Document</td>
                  <td className="py-2" data-testid="proof-source-document">{proof.anchor.source_document}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Page Index</td>
                  <td className="py-2 font-mono" data-testid="proof-page-index">{proof.anchor.provenance.page_index}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Page Ref</td>
                  <td className="py-2" data-testid="proof-page-ref">{proof.anchor.page_ref}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Quote Start</td>
                  <td className="py-2 font-mono" data-testid="proof-quote-start">{proof.anchor.provenance.quote_start_char}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Quote End</td>
                  <td className="py-2 font-mono" data-testid="proof-quote-end">{proof.anchor.provenance.quote_end_char}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Page Text SHA256</td>
                  <td className="py-2 font-mono text-xs break-all" data-testid="proof-page-text-sha256">{proof.page.page_text_sha256_hex}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Substring SHA256</td>
                  <td className="py-2 font-mono text-xs break-all" data-testid="proof-substring-sha256">{proof.repro.substring_sha256_hex}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-muted-foreground">Extractor Name</td>
                  <td className="py-2 font-mono" data-testid="proof-extractor-name">{proof.anchor.provenance.extractor.name}</td>
                </tr>
                <tr>
                  <td className="py-2 text-muted-foreground">Extractor Version</td>
                  <td className="py-2 font-mono" data-testid="proof-extractor-version">{proof.anchor.provenance.extractor.version}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quote</CardTitle>
          </CardHeader>
          <CardContent>
            <blockquote className="border-l-4 border-primary pl-4 italic" data-testid="proof-quote">
              "{proof.anchor.quote}"
            </blockquote>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Page Image</CardTitle>
          </CardHeader>
          <CardContent>
            <img 
              src={proof.page.page_png_url} 
              alt={`Page ${proof.anchor.provenance.page_index + 1}`}
              className="max-w-full border rounded"
              data-testid="proof-page-image"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

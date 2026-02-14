import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, XCircle, Download, FileText, Layers, Loader2 } from "lucide-react";
import { confidenceToBand, type ClaimClassification } from "@/lib/schema/claims";
import { type ConstraintItem } from "@/lib/schema/constraints";
import { apiGet } from "@/lib/auth";

interface SnapshotClaim {
  id: string;
  classification: ClaimClassification;
  text: string;
  confidence: number;
  refusal_reason: string | null;
  anchor_ids: string[];
}

interface SnapshotData {
  snapshot_id: string;
  created_at: string;
  corpus_id: string;
  claims: SnapshotClaim[];
  hash_alg: string;
  hash_hex: string;
}

interface VerifyResult {
  snapshot_id: string;
  verified: boolean;
  hash_alg: string;
  stored_hash_hex: string;
  recomputed_hash_hex: string;
}

export default function SnapshotDetail() {
  const params = useParams<{ snapshot_id: string }>();
  const snapshotId = params.snapshot_id;

  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const [constraints, setConstraints] = useState<ConstraintItem[]>([]);

  useEffect(() => {
    const fetchSnapshot = async () => {
      const result = await apiGet<SnapshotData>(`/api/snapshots/${snapshotId}`);
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setSnapshot(result.data);

      const constraintsResult = await apiGet<{ constraints: ConstraintItem[] }>(`/api/constraints?corpusId=${result.data.corpus_id}`);
      if (constraintsResult.ok) {
        setConstraints(constraintsResult.data.constraints || []);
      }
      setLoading(false);
    };

    fetchSnapshot();
  }, [snapshotId]);

  const handleVerify = async () => {
    setVerifying(true);
    const result = await apiGet<VerifyResult>(`/api/snapshots/${snapshotId}/verify`);
    if (!result.ok) {
      setError(result.error);
    } else {
      setVerifyResult(result.data);
    }
    setVerifying(false);
  };

  const handleExportJSON = async () => {
    const result = await apiGet<SnapshotData>(`/api/snapshots/${snapshotId}`);
    if (!result.ok) {
      setError("Failed to export JSON");
      return;
    }
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lantern-snapshot-${snapshotId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    if (!snapshot) return;

    const defensible = [...snapshot.claims.filter(c => c.classification === "DEFENSIBLE")].sort((a, b) => a.id.localeCompare(b.id));
    const restricted = [...snapshot.claims.filter(c => c.classification === "RESTRICTED")].sort((a, b) => a.id.localeCompare(b.id));
    const ambiguous = [...snapshot.claims.filter(c => c.classification === "AMBIGUOUS")].sort((a, b) => a.id.localeCompare(b.id));

    const conflicts = [...constraints.filter(c => c.type === "CONFLICT")].sort((a, b) => a.id.localeCompare(b.id));
    const missing = [...constraints.filter(c => c.type === "MISSING_EVIDENCE")].sort((a, b) => a.id.localeCompare(b.id));
    const timeMismatches = [...constraints.filter(c => c.type === "TIME_MISMATCH")].sort((a, b) => a.id.localeCompare(b.id));

    let content = `LANTERN SNAPSHOT EXPORT\n`;
    content += `========================\n\n`;
    content += `snapshot_id: ${snapshot.snapshot_id}\n`;
    content += `created_at: ${snapshot.created_at}\n`;
    content += `corpus_id: ${snapshot.corpus_id}\n`;
    content += `hash_alg: ${snapshot.hash_alg}\n`;
    content += `hash_hex: ${snapshot.hash_hex}\n\n`;

    content += `DEFENSIBLE CLAIMS\n`;
    content += `-----------------\n`;
    for (const claim of defensible) {
      content += `\nid: ${claim.id}\n`;
      content += `text: ${claim.text}\n`;
      content += `confidence: ${confidenceToBand(claim.confidence)}\n`;
      content += `anchor_ids: ${claim.anchor_ids.join(", ") || "(none)"}\n`;
    }
    if (defensible.length === 0) content += "(none)\n";

    content += `\nRESTRICTED CLAIMS\n`;
    content += `-----------------\n`;
    for (const claim of restricted) {
      content += `\nid: ${claim.id}\n`;
      content += `text: ${claim.text}\n`;
      content += `confidence: ${confidenceToBand(claim.confidence)}\n`;
      content += `refusal_reason: ${claim.refusal_reason || "(none)"}\n`;
      content += `anchor_ids: ${claim.anchor_ids.join(", ") || "(none)"}\n`;
    }
    if (restricted.length === 0) content += "(none)\n";

    content += `\nAMBIGUOUS CLAIMS\n`;
    content += `----------------\n`;
    for (const claim of ambiguous) {
      content += `\nid: ${claim.id}\n`;
      content += `text: ${claim.text}\n`;
      content += `confidence: ${confidenceToBand(claim.confidence)}\n`;
      content += `anchor_ids: ${claim.anchor_ids.join(", ") || "(none)"}\n`;
    }
    if (ambiguous.length === 0) content += "(none)\n";

    if (constraints.length > 0) {
      content += `\nCONSTRAINTS SUMMARY\n`;
      content += `===================\n`;

      if (conflicts.length > 0) {
        content += `\nCONFLICTS\n`;
        content += `---------\n`;
        for (const c of conflicts) {
          content += `id: ${c.id}\n`;
          content += `summary: ${c.summary}\n`;
          content += `anchor_ids: ${c.anchor_ids.join(", ") || "(none)"}\n\n`;
        }
      }

      if (missing.length > 0) {
        content += `\nMISSING EVIDENCE\n`;
        content += `----------------\n`;
        for (const c of missing) {
          content += `id: ${c.id}\n`;
          content += `summary: ${c.summary}\n`;
          content += `anchor_ids: ${c.anchor_ids.join(", ") || "(none)"}\n\n`;
        }
      }

      if (timeMismatches.length > 0) {
        content += `\nTIME MISMATCHES\n`;
        content += `---------------\n`;
        for (const c of timeMismatches) {
          content += `id: ${c.id}\n`;
          content += `summary: ${c.summary}\n`;
          content += `anchor_ids: ${c.anchor_ids.join(", ") || "(none)"}\n\n`;
        }
      }
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lantern-snapshot-${snapshotId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Link href="/snapshots">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Snapshots
            </Button>
          </Link>
          <Card className="border-red-500/30">
            <CardContent className="py-6 text-center text-red-400">
              {error || "Snapshot not found"}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const defensible = snapshot.claims.filter(c => c.classification === "DEFENSIBLE");
  const restricted = snapshot.claims.filter(c => c.classification === "RESTRICTED");
  const ambiguous = snapshot.claims.filter(c => c.classification === "AMBIGUOUS");

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">LANTERN</h1>
          </div>

          <Link href="/snapshots">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Snapshots
            </Button>
          </Link>

          <h2 className="text-lg font-semibold">Snapshot & Export</h2>
        </header>

        <Card className="mb-6" data-testid="snapshot-header">
          <CardHeader>
            <CardTitle className="text-base">Snapshot Header</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-xs font-mono">
              <span className="text-muted-foreground">snapshot_id: </span>
              <span>{snapshot.snapshot_id}</span>
            </div>
            <div className="text-xs font-mono">
              <span className="text-muted-foreground">created_at: </span>
              <span>{snapshot.created_at}</span>
            </div>
            <div className="text-xs font-mono">
              <span className="text-muted-foreground">corpus_id: </span>
              <span>{snapshot.corpus_id}</span>
            </div>
            <div className="text-xs font-mono">
              <span className="text-muted-foreground">hash_alg: </span>
              <span>{snapshot.hash_alg}</span>
            </div>
            <div className="text-xs font-mono break-all">
              <span className="text-muted-foreground">hash_hex: </span>
              <span>{snapshot.hash_hex}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Verify Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleVerify}
              disabled={verifying}
              variant="outline"
              data-testid="button-verify"
            >
              {verifying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Verify
            </Button>

            {verifyResult && (
              <div className={`p-4 rounded border text-xs font-mono space-y-2 ${
                verifyResult.verified 
                  ? "bg-emerald-500/10 border-emerald-500/30" 
                  : "bg-red-500/10 border-red-500/30"
              }`} data-testid="verify-result">
                <div className="flex items-center gap-2">
                  {verifyResult.verified ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className={verifyResult.verified ? "text-emerald-400" : "text-red-400"}>
                    verified: {verifyResult.verified ? "true" : "false"}
                  </span>
                </div>
                <div className="break-all">
                  <span className="text-muted-foreground">stored_hash_hex: </span>
                  <span>{verifyResult.stored_hash_hex}</span>
                </div>
                <div className="break-all">
                  <span className="text-muted-foreground">recomputed_hash_hex: </span>
                  <span>{verifyResult.recomputed_hash_hex}</span>
                </div>
                {!verifyResult.verified && (
                  <div className="text-red-400 mt-2">
                    Verification failed: hash mismatch.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Export</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button
              onClick={handleExportJSON}
              variant="outline"
              data-testid="button-export-json"
            >
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
            <Button
              onClick={handleExportPDF}
              variant="outline"
              data-testid="button-export-pdf"
            >
              <FileText className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Claims Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 text-sm">
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                Defensible: {defensible.length}
              </Badge>
              <Badge variant="outline" className="text-red-500 border-red-500/30">
                Restricted: {restricted.length}
              </Badge>
              <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                Ambiguous: {ambiguous.length}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <footer className="mt-12 pt-6 border-t border-border/50 text-center text-xs text-muted-foreground">
          <p>No reclassification. No recomputation. No interpretation.</p>
        </footer>
      </div>
    </div>
  );
}

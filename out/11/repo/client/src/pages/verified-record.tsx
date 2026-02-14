import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/auth";
import { Download, FileText, FileJson, Shield, AlertTriangle, Clock, HelpCircle, CheckCircle, XCircle, ArrowLeft } from "lucide-react";

interface VerifiedRecord {
  schema: string;
  integrity: {
    record_hash_alg: string;
    record_hash_hex: string;
    generated_at: string;
    schema_version: string;
    corpus_id: string;
    corpus_purpose: string;
    corpus_created_at: string;
  };
  sources: {
    source_id: string;
    filename: string;
    role: string;
    sha256_hex: string;
    uploaded_at: string;
    page_count: number | null;
  }[];
  supported_claims: {
    claim_id: string;
    classification: string;
    text: string;
    confidence: number;
    anchor_ids: string[];
    anchors: { anchor_id: string; source_document: string; page_ref: string; quote: string }[];
    created_at: string;
  }[];
  restricted_claims: {
    claim_id: string;
    classification: string;
    text: string;
    refusal_reason: string;
    anchor_ids: string[];
    created_at: string;
  }[];
  ambiguous_claims: {
    claim_id: string;
    classification: string;
    text: string;
    confidence: number;
    anchor_ids: string[];
    anchors: { anchor_id: string; source_document: string; page_ref: string; quote: string }[];
    created_at: string;
  }[];
  conflicts: {
    constraint_id: string;
    type: string;
    summary: string;
    claim_id: string | null;
    left_anchor: { anchor_id: string; source_document: string; page_ref: string };
    right_anchor: { anchor_id: string; source_document: string; page_ref: string };
  }[];
  missing_evidence: {
    constraint_id: string;
    type: string;
    summary: string;
    requested_assertion: string;
    reason: string;
  }[];
  time_mismatches: {
    constraint_id: string;
    type: string;
    summary: string;
    claim_id: string | null;
    earlier_date: string;
    later_date: string;
    note: string;
  }[];
  summary: {
    total_sources: number;
    total_anchors: number;
    total_claims: number;
    supported_count: number;
    restricted_count: number;
    ambiguous_count: number;
    conflicts_count: number;
    missing_evidence_count: number;
    time_mismatches_count: number;
  };
}

export default function VerifiedRecordPage() {
  const [, setLocation] = useLocation();
  const [record, setRecord] = useState<VerifiedRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [corpusId, setCorpusId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("corpusId");
    setCorpusId(id);
    
    if (id) {
      fetchRecord(id);
    } else {
      setError("No corpus ID provided");
      setLoading(false);
    }
  }, []);

  const fetchRecord = async (id: string) => {
    setLoading(true);
    setError(null);
    
    const result = await apiGet<VerifiedRecord>(`/api/corpus/${id}/verified-record`);
    
    if (result.ok) {
      setRecord(result.data);
    } else {
      setError(result.error || "Failed to load Verified Record");
    }
    setLoading(false);
  };

  const downloadJson = () => {
    if (!record) return;
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verified-record-${corpusId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    if (!corpusId) return;
    window.open(`/api/corpus/${corpusId}/verified-record.pdf`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-8 w-64 mb-6 bg-zinc-800" />
          <Skeleton className="h-32 w-full mb-4 bg-zinc-800" />
          <Skeleton className="h-64 w-full bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-red-400 text-center py-12">{error}</div>
        </div>
      </div>
    );
  }

  if (!record) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation(`/?corpusId=${corpusId}`)}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Claims
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-emerald-400" />
              Verified Record
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadJson} data-testid="button-download-json">
              <FileJson className="h-4 w-4 mr-2" />
              Download JSON
            </Button>
            <Button variant="outline" onClick={downloadPdf} data-testid="button-download-pdf">
              <FileText className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>

        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-400" />
              Integrity Metadata
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-500">Corpus ID:</span>
                <span className="ml-2 font-mono text-zinc-300">{record.integrity.corpus_id}</span>
              </div>
              <div>
                <span className="text-zinc-500">Purpose:</span>
                <span className="ml-2 text-zinc-300">{record.integrity.corpus_purpose}</span>
              </div>
              <div>
                <span className="text-zinc-500">Generated:</span>
                <span className="ml-2 text-zinc-300">{new Date(record.integrity.generated_at).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-zinc-500">Schema:</span>
                <span className="ml-2 font-mono text-zinc-300">{record.schema}</span>
              </div>
              <div className="col-span-2">
                <span className="text-zinc-500">{record.integrity.record_hash_alg}:</span>
                <span className="ml-2 font-mono text-xs text-emerald-400 break-all">{record.integrity.record_hash_hex}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="text-2xl font-bold text-emerald-400">{record.summary.supported_count}</div>
                <div className="text-xs text-zinc-500">Supported Claims</div>
              </div>
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="text-2xl font-bold text-red-400">{record.summary.restricted_count}</div>
                <div className="text-xs text-zinc-500">Restricted Claims</div>
              </div>
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="text-2xl font-bold text-amber-400">{record.summary.ambiguous_count}</div>
                <div className="text-xs text-zinc-500">Ambiguous Claims</div>
              </div>
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="text-2xl font-bold text-zinc-300">{record.summary.total_sources}</div>
                <div className="text-xs text-zinc-500">Sources</div>
              </div>
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="text-2xl font-bold text-zinc-300">{record.summary.total_anchors}</div>
                <div className="text-xs text-zinc-500">Anchors</div>
              </div>
              <div className="p-4 bg-zinc-800 rounded-lg">
                <div className="text-2xl font-bold text-orange-400">
                  {record.summary.conflicts_count + record.summary.missing_evidence_count + record.summary.time_mismatches_count}
                </div>
                <div className="text-xs text-zinc-500">Constraints</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="h-5 w-5" />
              Input Sources ({record.sources.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {record.sources.map((src) => (
                <div key={src.source_id} className="p-3 bg-zinc-800 rounded-lg text-sm" data-testid={`source-${src.source_id}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-200">{src.filename}</span>
                    <Badge variant={src.role === "PRIMARY" ? "default" : "secondary"} className="text-xs">
                      {src.role}
                    </Badge>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 font-mono break-all">
                    SHA-256: {src.sha256_hex}
                  </div>
                </div>
              ))}
              {record.sources.length === 0 && (
                <div className="text-zinc-500 text-center py-4">No sources</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              Supported Claims ({record.supported_claims.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {record.supported_claims.map((claim) => (
                <div key={claim.claim_id} className="p-3 bg-zinc-800 rounded-lg border-l-4 border-emerald-500" data-testid={`claim-supported-${claim.claim_id}`}>
                  <div className="text-sm text-zinc-200 mb-2">{claim.text}</div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>Confidence: {(claim.confidence * 100).toFixed(0)}%</span>
                    <span>|</span>
                    <span>{claim.anchors.length} anchor(s)</span>
                  </div>
                  {claim.anchors.length > 0 && (
                    <div className="mt-2 pl-3 border-l border-zinc-700">
                      {claim.anchors.slice(0, 2).map((anchor) => (
                        <div key={anchor.anchor_id} className="text-xs text-zinc-400 mb-1">
                          "{anchor.quote.substring(0, 100)}{anchor.quote.length > 100 ? "..." : ""}"
                          <span className="text-zinc-600 ml-2">— {anchor.source_document}, {anchor.page_ref}</span>
                        </div>
                      ))}
                      {claim.anchors.length > 2 && (
                        <div className="text-xs text-zinc-600">+{claim.anchors.length - 2} more anchors</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {record.supported_claims.length === 0 && (
                <div className="text-zinc-500 text-center py-4">No supported claims</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-400" />
              Restricted Claims ({record.restricted_claims.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {record.restricted_claims.map((claim) => (
                <div key={claim.claim_id} className="p-3 bg-zinc-800 rounded-lg border-l-4 border-red-500" data-testid={`claim-restricted-${claim.claim_id}`}>
                  <div className="text-sm text-zinc-200 mb-2">{claim.text}</div>
                  <div className="text-xs text-red-400">
                    Reason: {claim.refusal_reason}
                  </div>
                </div>
              ))}
              {record.restricted_claims.length === 0 && (
                <div className="text-zinc-500 text-center py-4">No restricted claims</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-amber-400" />
              Ambiguous Claims ({record.ambiguous_claims.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {record.ambiguous_claims.map((claim) => (
                <div key={claim.claim_id} className="p-3 bg-zinc-800 rounded-lg border-l-4 border-amber-500" data-testid={`claim-ambiguous-${claim.claim_id}`}>
                  <div className="text-sm text-zinc-200 mb-2">{claim.text}</div>
                  <div className="text-xs text-zinc-500">
                    Confidence: {(claim.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
              {record.ambiguous_claims.length === 0 && (
                <div className="text-zinc-500 text-center py-4">No ambiguous claims</div>
              )}
            </div>
          </CardContent>
        </Card>

        {record.conflicts.length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                Conflicts ({record.conflicts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {record.conflicts.map((conflict) => (
                  <div key={conflict.constraint_id} className="p-3 bg-zinc-800 rounded-lg border-l-4 border-orange-500" data-testid={`conflict-${conflict.constraint_id}`}>
                    <div className="text-sm text-zinc-200 mb-2">{conflict.summary}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
                      <div>Left: {conflict.left_anchor.source_document} ({conflict.left_anchor.page_ref})</div>
                      <div>Right: {conflict.right_anchor.source_document} ({conflict.right_anchor.page_ref})</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {record.missing_evidence.length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-zinc-400" />
                Missing Evidence ({record.missing_evidence.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {record.missing_evidence.map((me) => (
                  <div key={me.constraint_id} className="p-3 bg-zinc-800 rounded-lg" data-testid={`missing-${me.constraint_id}`}>
                    <div className="text-sm text-zinc-200 mb-1">{me.summary}</div>
                    <div className="text-xs text-zinc-500">Requested: {me.requested_assertion}</div>
                    <div className="text-xs text-zinc-500">Reason: {me.reason}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {record.time_mismatches.length > 0 && (
          <Card className="bg-zinc-900 border-zinc-800 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-400" />
                Time Mismatches ({record.time_mismatches.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {record.time_mismatches.map((tm) => (
                  <div key={tm.constraint_id} className="p-3 bg-zinc-800 rounded-lg border-l-4 border-purple-500" data-testid={`time-mismatch-${tm.constraint_id}`}>
                    <div className="text-sm text-zinc-200 mb-1">{tm.summary}</div>
                    <div className="text-xs text-zinc-500">
                      {tm.earlier_date} → {tm.later_date}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">{tm.note}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-xs text-zinc-600 py-8">
          This Verified Record is the canonical output artifact for courts, regulators, and audits.
          <br />
          All UI views are projections of this single deterministic object.
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, XCircle, Download, FileText, Loader2, Shield, Anchor, Link2 } from "lucide-react";
import { apiGet } from "@/lib/auth";

interface EvidencePacketData {
  packet_id: string;
  created_at: string;
  corpus_id: string;
  snapshot_id: string;
  snapshot_hash_hex: string;
  claim: {
    id: string;
    classification: "DEFENSIBLE";
    text: string;
    confidence: number;
    anchor_ids: string[];
  };
  anchors: {
    id: string;
    quote: string;
    source_document: string;
    page_ref: string;
    section_ref?: string | null;
    timeline_date: string;
    source_id: string;
  }[];
  hash_alg: "SHA-256";
  hash_hex: string;
}

interface VerifyResponse {
  packet_id: string;
  verified: boolean;
  hash_alg: string;
  stored_hash_hex: string;
  recomputed_hash_hex: string;
}

interface VerifyChainResponse {
  packet_id: string;
  verified_packet_hash: boolean;
  verified_snapshot_hash: boolean;
  snapshot_id: string;
  snapshot_hash_match: boolean;
  claim_in_snapshot_scope: boolean;
  sources_in_snapshot_scope: boolean;
}

function formatHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

export default function EvidencePacket() {
  const params = useParams<{ packetId: string }>();
  const packetId = params.packetId;
  const [, navigate] = useLocation();

  const [packet, setPacket] = useState<EvidencePacketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [verifyingChain, setVerifyingChain] = useState(false);
  const [verifyChainResult, setVerifyChainResult] = useState<VerifyChainResponse | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!packetId) return;
    
    const fetchPacket = async () => {
      setLoading(true);
      const result = await apiGet<EvidencePacketData>(`/api/packets/${packetId}`);
      if (!result.ok) {
        setError(result.error);
      } else {
        setPacket(result.data);
      }
      setLoading(false);
    };
    
    fetchPacket();
  }, [packetId]);

  const handleVerify = async () => {
    if (!packetId) return;
    setVerifying(true);
    setVerifyResult(null);
    
    const result = await apiGet<VerifyResponse>(`/api/packets/${packetId}/verify`);
    if (!result.ok) {
      setError(result.error);
    } else {
      setVerifyResult(result.data);
    }
    setVerifying(false);
  };

  const handleVerifyChain = async () => {
    if (!packetId) return;
    setVerifyingChain(true);
    setVerifyChainResult(null);
    
    const result = await apiGet<VerifyChainResponse>(`/api/packets/${packetId}/verify_chain`);
    if (!result.ok) {
      setError(result.error);
    } else {
      setVerifyChainResult(result.data);
    }
    setVerifyingChain(false);
  };

  const handleExportJson = () => {
    if (!packet) return;
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lantern-packet-${packet.packet_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    if (!packet) return;
    setExporting(true);
    
    try {
      const apiKey = localStorage.getItem("lantern_api_key");
      const headers: HeadersInit = {};
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
      
      const response = await fetch(`/api/packets/${packet.packet_id}.pdf`, { headers });
      if (!response.ok) {
        throw new Error("Failed to download PDF");
      }
      
      const text = await response.text();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lantern-packet-${packet.packet_id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="border-red-500/30">
            <CardContent className="py-6 text-center">
              <p className="text-red-400">{error}</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Claim Space
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!packet) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              Packet not found.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(`/?corpusId=${packet.corpus_id}`)}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Claim Space
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Evidence Packet</h1>
            <p className="text-xs font-mono text-muted-foreground mt-1" data-testid="packet-id">
              packet_id: {packet.packet_id}
            </p>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerify}
              disabled={verifying}
              data-testid="button-verify-packet"
            >
              {verifying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              Verify Packet
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifyChain}
              disabled={verifyingChain}
              data-testid="button-verify-chain"
            >
              {verifyingChain ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              Verify Chain
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJson}
              data-testid="button-export-json"
            >
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={exporting}
              data-testid="button-export-pdf"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Export PDF
            </Button>
          </div>
        </header>

        {verifyResult && (
          <Card className={verifyResult.verified ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"} data-testid="verify-result">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                {verifyResult.verified ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <div>
                  <p className={`font-semibold ${verifyResult.verified ? "text-emerald-400" : "text-red-400"}`}>
                    {verifyResult.verified ? "Verification Passed" : "Verification Failed"}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    Stored: {formatHash(verifyResult.stored_hash_hex)}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    Recomputed: {formatHash(verifyResult.recomputed_hash_hex)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {verifyChainResult && (
          <Card className="border-cyan-500/30 bg-cyan-500/5" data-testid="verify-chain-result">
            <CardContent className="py-4 space-y-3">
              <p className="text-sm font-semibold text-cyan-400">Chain Verification Results</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  {verifyChainResult.verified_packet_hash ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>verified_packet_hash</span>
                </div>
                <div className="flex items-center gap-2">
                  {verifyChainResult.verified_snapshot_hash ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>verified_snapshot_hash</span>
                </div>
                <div className="flex items-center gap-2">
                  {verifyChainResult.snapshot_hash_match ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>snapshot_hash_match</span>
                </div>
                <div className="flex items-center gap-2">
                  {verifyChainResult.claim_in_snapshot_scope ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>claim_in_snapshot_scope</span>
                </div>
                <div className="flex items-center gap-2">
                  {verifyChainResult.sources_in_snapshot_scope ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span>sources_in_snapshot_scope</span>
                </div>
              </div>
              <p className="text-xs font-mono text-muted-foreground">
                snapshot_id: {verifyChainResult.snapshot_id}
              </p>
            </CardContent>
          </Card>
        )}

        <Card data-testid="packet-header">
          <CardHeader>
            <CardTitle className="text-lg">Packet Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Packet ID</span>
              <span className="font-mono">{packet.packet_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(packet.created_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Corpus ID</span>
              <span className="font-mono">{formatHash(packet.corpus_id)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Snapshot ID</span>
              <span className="font-mono">{formatHash(packet.snapshot_id)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Snapshot Hash</span>
              <span className="font-mono">{formatHash(packet.snapshot_hash_hex)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hash Algorithm</span>
              <span>{packet.hash_alg}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hash</span>
              <span className="font-mono">{formatHash(packet.hash_hex)}</span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="packet-claim">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              Claim
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded font-semibold">
                {packet.claim.classification}
              </span>
              <span className="text-xs text-muted-foreground">
                Confidence: {(packet.claim.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-sm">{packet.claim.text}</p>
            <div className="text-xs font-mono text-muted-foreground">
              claim_id: {packet.claim.id}
            </div>
            <div className="text-xs text-muted-foreground">
              Anchors: {packet.claim.anchor_ids.length}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Anchor className="w-5 h-5 text-cyan-500" />
            Anchors ({packet.anchors.length})
          </h2>
          
          {packet.anchors.map((anchor, idx) => (
            <Card key={anchor.id} data-testid={`anchor-${anchor.id}`}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">
                    [{idx + 1}] anchor_id: {anchor.id}
                  </span>
                </div>
                
                <blockquote className="border-l-2 border-cyan-500/50 pl-4 py-2 bg-muted/30 rounded-r text-sm italic">
                  "{anchor.quote}"
                </blockquote>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Source:</span>{" "}
                    <span className="font-medium">{anchor.source_document}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Page:</span>{" "}
                    <span className="font-medium">{anchor.page_ref}</span>
                  </div>
                  {anchor.section_ref && (
                    <div>
                      <span className="text-muted-foreground">Section:</span>{" "}
                      <span className="font-medium">{anchor.section_ref}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Date:</span>{" "}
                    <span className="font-medium">{anchor.timeline_date}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <footer className="pt-6 border-t border-border/50 text-center text-xs text-muted-foreground">
          <p>Lantern v1.0 — Claim Governance Interface</p>
          <p className="mt-1">No inferred intent. No rankings. No synthesis. No conclusions.</p>
        </footer>
      </div>
    </div>
  );
}

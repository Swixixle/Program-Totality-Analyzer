import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, HelpCircle, Eye, Layers, Camera, CheckCheck, Loader2, Anchor, FileText, Shield } from "lucide-react";
import { confidenceToBand, clampConfidence, type Claim } from "@/lib/schema/claims";
import { useReadOnlyMode } from "@/lib/config";
import { apiGet, apiPost } from "@/lib/auth";

interface SnapshotResult {
  snapshot_id: string;
  created_at: string;
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

interface SnapshotOption {
  snapshot_id: string;
  created_at: string;
  hash_hex: string;
}

function ClaimCard({ claim, corpusId, onGeneratePacket, isReadOnly }: { claim: Claim; corpusId: string; onGeneratePacket: (claimId: string) => void; isReadOnly: boolean }) {
  const [, navigate] = useLocation();
  
  const handleViewEvidence = () => {
    if (claim.anchor_ids.length > 0) {
      navigate(`/anchors?ids=${claim.anchor_ids.join(",")}&claimId=${claim.id}`);
    } else {
      navigate(`/anchors?claimId=${claim.id}&empty=true`);
    }
  };

  return (
    <Card 
      className={`border-l-4 ${
        claim.classification === "DEFENSIBLE" ? "border-l-emerald-500" :
        claim.classification === "RESTRICTED" ? "border-l-red-500" :
        "border-l-amber-500"
      }`}
      data-testid={`claim-card-${claim.id}`}
    >
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm mb-2">{claim.text}</p>
            
            {claim.classification === "RESTRICTED" && claim.refusal_reason && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                <span className="font-semibold">Not supported by corpus: </span>
                {claim.refusal_reason}
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <Badge 
              variant="outline" 
              className="text-xs font-mono"
              data-testid={`confidence-${claim.id}`}
            >
              {confidenceToBand(claim.confidence)}
            </Badge>
            
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleViewEvidence}
              className="text-xs"
              data-testid={`view-evidence-${claim.id}`}
            >
              <Eye className="w-3 h-3 mr-1" />
              View Evidence
            </Button>
            
            {claim.classification === "DEFENSIBLE" && claim.anchor_ids.length > 0 && !isReadOnly && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onGeneratePacket(claim.id)}
                className="text-xs"
                data-testid={`generate-packet-${claim.id}`}
              >
                <FileText className="w-3 h-3 mr-1" />
                Generate Evidence Packet
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ClaimSection({ 
  title, 
  icon, 
  claims, 
  emptyMessage,
  corpusId,
  onGeneratePacket,
  isReadOnly
}: { 
  title: string; 
  icon: React.ReactNode; 
  claims: Claim[]; 
  emptyMessage: string;
  corpusId: string;
  onGeneratePacket: (claimId: string) => void;
  isReadOnly: boolean;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
        {icon}
        {title}
        <Badge variant="secondary" className="ml-2 text-xs">{claims.length}</Badge>
      </h2>
      
      {claims.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-muted-foreground text-sm">
            {emptyMessage}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} corpusId={corpusId} onGeneratePacket={onGeneratePacket} isReadOnly={isReadOnly} />
          ))}
        </div>
      )}
    </section>
  );
}

function formatHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

export default function ClaimSpace() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const corpusIdFromQuery = params.get("corpusId");
  const { isReadOnly } = useReadOnlyMode();
  
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState<SnapshotResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [snapshots, setSnapshots] = useState<SnapshotOption[]>([]);
  const [showSnapshotSelect, setShowSnapshotSelect] = useState(false);
  const [pendingClaimId, setPendingClaimId] = useState<string | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>("");
  const [generatingPacket, setGeneratingPacket] = useState(false);
  
  const corpusId = corpusIdFromQuery || "corpus-demo-001";
  
  useEffect(() => {
    if (!corpusIdFromQuery) return;
    
    const fetchClaims = async () => {
      setLoading(true);
      setError(null);
      
      const result = await apiGet<{ claims: any[] }>(`/api/corpus/${corpusIdFromQuery}/claims`);
      if (!result.ok) {
        setError(result.error);
      } else {
        setClaims(result.data.claims.map((c: any) => ({
          id: c.id,
          classification: c.classification,
          text: c.text,
          confidence: c.confidence,
          refusal_reason: c.refusal_reason,
          anchor_ids: c.anchor_ids
        })));
      }
      setLoading(false);
    };
    
    fetchClaims();
  }, [corpusIdFromQuery]);
  
  const defensible = claims.filter(c => c.classification === "DEFENSIBLE");
  const restricted = claims.filter(c => c.classification === "RESTRICTED");
  const ambiguous = claims.filter(c => c.classification === "AMBIGUOUS");

  const handleGeneratePacket = async (claimId: string) => {
    const result = await apiGet<{ snapshots: SnapshotOption[] }>(`/api/corpus/${corpusId}/snapshots`);
    if (!result.ok) {
      setError(result.error);
    } else {
      setSnapshots(result.data.snapshots);
      setPendingClaimId(claimId);
      setSelectedSnapshotId(result.data.snapshots.length > 0 ? result.data.snapshots[0].snapshot_id : "");
      setShowSnapshotSelect(true);
    }
  };

  const handleConfirmPacketGeneration = async () => {
    if (!pendingClaimId || !selectedSnapshotId) return;
    
    setGeneratingPacket(true);
    const result = await apiPost<{ packet_id: string }>(`/api/corpus/${corpusId}/claims/${pendingClaimId}/packet`, { snapshot_id: selectedSnapshotId });
    
    if (!result.ok) {
      setError(result.error);
    } else {
      setShowSnapshotSelect(false);
      setPendingClaimId(null);
      navigate(`/packets/${result.data.packet_id}`);
    }
    setGeneratingPacket(false);
  };

  const handleSaveSnapshot = async () => {
    setSaving(true);
    setError(null);
    setVerifyResult(null);
    
    const claimsPayload = claims.map(c => ({
      id: c.id,
      classification: c.classification,
      text: c.text,
      confidence: clampConfidence(c.confidence),
      refusal_reason: c.refusal_reason,
      anchor_ids: c.anchor_ids
    }));
    
    const result = await apiPost<SnapshotResult>("/api/snapshots", {
      corpus_id: corpusId,
      claims: claimsPayload
    });
    
    if (!result.ok) {
      setError(result.error);
    } else {
      setSnapshot(result.data);
    }
    setSaving(false);
  };

  const handleVerifySnapshot = async () => {
    if (!snapshot) return;
    
    setVerifying(true);
    setError(null);
    
    const result = await apiGet<VerifyResult>(`/api/snapshots/${snapshot.snapshot_id}/verify`);
    
    if (!result.ok) {
      setError(result.error);
    } else {
      setVerifyResult(result.data);
    }
    setVerifying(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">LANTERN</h1>
            </div>
            
            {!isReadOnly && (
              <Button 
                onClick={handleSaveSnapshot}
                disabled={saving || claims.length === 0}
                className="bg-cyan-600 hover:bg-cyan-500"
                data-testid="button-save-snapshot"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 mr-2" />
                )}
                Save Snapshot
              </Button>
            )}
          </div>
          <p className="text-muted-foreground">Claim Space</p>
          {corpusIdFromQuery && (
            <p className="text-xs font-mono text-muted-foreground mt-1" data-testid="corpus-id-display">
              corpus_id: {corpusId}
            </p>
          )}
        </header>

        {error && (
          <Card className="mb-6 border-red-500/30">
            <CardContent className="py-3 text-sm text-red-400">
              {error}
            </CardContent>
          </Card>
        )}

        {showSnapshotSelect && !isReadOnly && (
          <Card className="mb-6 border-amber-500/30 bg-amber-500/5" data-testid="snapshot-select-dialog">
            <CardContent className="py-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-amber-400">Select Snapshot for Evidence Packet</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowSnapshotSelect(false); setPendingClaimId(null); }}
                >
                  Cancel
                </Button>
              </div>
              
              {snapshots.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  <p>Create a snapshot before generating a packet.</p>
                  <p className="text-xs mt-1">Use the "Save Snapshot" button above to create one.</p>
                </div>
              ) : (
                <>
                  <select
                    value={selectedSnapshotId}
                    onChange={(e) => setSelectedSnapshotId(e.target.value)}
                    className="w-full p-2 rounded border bg-background text-sm"
                    data-testid="snapshot-select-dropdown"
                  >
                    {snapshots.map((s) => (
                      <option key={s.snapshot_id} value={s.snapshot_id}>
                        {new Date(s.created_at).toLocaleString()} - {formatHash(s.hash_hex)}
                      </option>
                    ))}
                  </select>
                  
                  <Button
                    onClick={handleConfirmPacketGeneration}
                    disabled={generatingPacket || !selectedSnapshotId}
                    className="w-full"
                    data-testid="button-confirm-packet"
                  >
                    {generatingPacket ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 mr-2" />
                    )}
                    Generate Packet with Selected Snapshot
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {snapshot && (
          <Card className="mb-6 border-cyan-500/30 bg-cyan-500/5" data-testid="snapshot-result">
            <CardContent className="py-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-cyan-400">Snapshot Created</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    ID: {snapshot.snapshot_id}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    Hash ({snapshot.hash_alg}): {formatHash(snapshot.hash_hex)}
                  </p>
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleVerifySnapshot}
                  disabled={verifying}
                  data-testid="button-verify-snapshot"
                >
                  {verifying ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3 h-3 mr-1" />
                  )}
                  Verify
                </Button>
              </div>
              
              {verifyResult && (
                <div className={`mt-3 p-2 rounded text-xs ${
                  verifyResult.verified 
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" 
                    : "bg-red-500/10 border border-red-500/30 text-red-400"
                }`}>
                  {verifyResult.verified ? (
                    <span className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Verified: Hash matches stored value
                    </span>
                  ) : (
                    <span>
                      Verification Failed: Hashes do not match
                      <br />
                      Stored: {formatHash(verifyResult.stored_hash_hex)}
                      <br />
                      Computed: {formatHash(verifyResult.recomputed_hash_hex)}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {corpusIdFromQuery && (
          <div className="mb-6">
            <Button
              onClick={() => navigate(`/anchors/browse?corpusId=${corpusId}`)}
              variant="outline"
              className="w-full"
              data-testid="button-anchor-browser"
            >
              <Anchor className="w-4 h-4 mr-2" />
              Browse Anchors & Create Claims
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : claims.length === 0 && corpusIdFromQuery ? (
          <Card className="border-dashed mb-8">
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No claims have been created for this corpus.</p>
              <p className="text-sm mt-2">Use the Anchor Browser to create claims from anchors.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <ClaimSection
              title="Defensible Claims"
              icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
              claims={defensible}
              emptyMessage="No defensible claims in this corpus."
              corpusId={corpusId}
              onGeneratePacket={handleGeneratePacket}
              isReadOnly={isReadOnly}
            />

            <ClaimSection
              title="Restricted / Unsupported Claims"
              icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
              claims={restricted}
              emptyMessage="No restricted claims identified."
              corpusId={corpusId}
              onGeneratePacket={handleGeneratePacket}
              isReadOnly={isReadOnly}
            />

            <ClaimSection
              title="Ambiguous Claims"
              icon={<HelpCircle className="w-5 h-5 text-amber-500" />}
              claims={ambiguous}
              emptyMessage="No ambiguous claims identified."
              corpusId={corpusId}
              onGeneratePacket={handleGeneratePacket}
              isReadOnly={isReadOnly}
            />
          </>
        )}

        <div className="mt-8 pt-6 border-t border-border/50 flex gap-4">
          <Link href={`/constraints?corpusId=${corpusId}`} className="flex-1">
            <Button variant="outline" className="w-full" data-testid="button-constraints">
              <AlertTriangle className="w-4 h-4 mr-2" />
              View Constraints & Friction
            </Button>
          </Link>
          <Link href={`/verified-record?corpusId=${corpusId}`} className="flex-1">
            <Button variant="default" className="w-full" data-testid="button-verified-record">
              <Shield className="w-4 h-4 mr-2" />
              Export Verified Record
            </Button>
          </Link>
        </div>

        <footer className="mt-12 pt-6 border-t border-border/50 text-center text-xs text-muted-foreground">
          <p>Lantern v1.0 — Claim Governance Interface</p>
          <p className="mt-1">No inferred intent. No rankings. No synthesis. No conclusions.</p>
        </footer>
      </div>
    </div>
  );
}

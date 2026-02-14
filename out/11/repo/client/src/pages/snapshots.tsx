import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Camera, ExternalLink, Layers, Loader2 } from "lucide-react";
import { MOCK_CLAIMS, clampConfidence, type Claim } from "@/lib/schema/claims";
import { useReadOnlyMode } from "@/lib/config";
import { apiPost } from "@/lib/auth";

interface SnapshotResult {
  snapshot_id: string;
  created_at: string;
  hash_alg: string;
  hash_hex: string;
}

export default function Snapshots() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const { isReadOnly } = useReadOnlyMode();
  const [claims] = useState<Claim[]>(MOCK_CLAIMS);
  const corpusId = params.get("corpusId") || "corpus-demo-001";

  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState<SnapshotResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [openId, setOpenId] = useState("");

  const handleSaveSnapshot = async () => {
    setSaving(true);
    setError(null);

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

  const handleOpenSnapshot = () => {
    if (openId.trim()) {
      navigate(`/snapshots/${openId.trim()}`);
    }
  };

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

          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-4" 
            data-testid="button-back"
            onClick={() => navigate(`/?corpusId=${corpusId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Claim Space
          </Button>

          <h2 className="text-lg font-semibold">Snapshot & Export</h2>
        </header>

        {error && (
          <Card className="mb-6 border-red-500/30">
            <CardContent className="py-3 text-sm text-red-400">
              {error}
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Create Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

            {snapshot && (
              <div className="p-4 bg-muted/30 rounded border space-y-2" data-testid="snapshot-result">
                <div className="text-xs font-mono">
                  <span className="text-muted-foreground">snapshot_id: </span>
                  <span>{snapshot.snapshot_id}</span>
                </div>
                <div className="text-xs font-mono">
                  <span className="text-muted-foreground">created_at: </span>
                  <span>{snapshot.created_at}</span>
                </div>
                <div className="text-xs font-mono">
                  <span className="text-muted-foreground">hash_alg: </span>
                  <span>{snapshot.hash_alg}</span>
                </div>
                <div className="text-xs font-mono break-all">
                  <span className="text-muted-foreground">hash_hex: </span>
                  <span>{snapshot.hash_hex}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/snapshots/${snapshot.snapshot_id}`)}
                  className="mt-2"
                  data-testid="button-open-created-snapshot"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Open Snapshot
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open Existing Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter snapshot ID"
                value={openId}
                onChange={(e) => setOpenId(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-snapshot-id"
              />
              <Button
                onClick={handleOpenSnapshot}
                disabled={!openId.trim()}
                variant="outline"
                data-testid="button-open-snapshot"
              >
                Open
              </Button>
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

import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, Anchor, FileText, CheckCircle, Loader2, Eye } from "lucide-react";
import { Link } from "wouter";
import { apiGet, apiPost } from "@/lib/auth";

interface AnchorRecord {
  id: string;
  corpus_id: string;
  source_id: string;
  quote: string;
  source_document: string;
  page_ref: string;
  section_ref: string | null;
  timeline_date: string;
}

interface SourceRecord {
  source_id: string;
  corpus_id: string;
  role: string;
  filename: string;
}

interface ClaimResult {
  id: string;
  classification: string;
  text: string;
  confidence: number;
  refusal_reason: string | null;
  anchor_ids: string[];
}

export default function AnchorBrowser() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const corpusId = params.get("corpusId") || "corpus-demo-001";

  const [anchors, setAnchors] = useState<AnchorRecord[]>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");

  const [selectedAnchorIds, setSelectedAnchorIds] = useState<Set<string>>(new Set());
  const [claimText, setClaimText] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdClaim, setCreatedClaim] = useState<ClaimResult | null>(null);

  useEffect(() => {
    if (!corpusId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const sourcesResult = await apiGet<{ sources: SourceRecord[] }>(`/api/corpus/${corpusId}/sources`);
      if (sourcesResult.ok) {
        setSources(sourcesResult.data.sources);
      }

      let url = `/api/corpus/${corpusId}/anchors`;
      const queryParams: string[] = [];
      if (roleFilter !== "ALL") queryParams.push(`role=${roleFilter}`);
      if (sourceFilter !== "ALL") queryParams.push(`source_id=${sourceFilter}`);
      if (queryParams.length > 0) url += `?${queryParams.join("&")}`;

      const anchorsResult = await apiGet<{ anchors: AnchorRecord[] }>(url);
      if (!anchorsResult.ok) {
        setError(anchorsResult.error);
      } else {
        setAnchors(anchorsResult.data.anchors);
      }
      setLoading(false);
    };

    fetchData();
  }, [corpusId, roleFilter, sourceFilter]);

  const toggleAnchor = (id: string) => {
    setSelectedAnchorIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateClaim = async () => {
    if (!corpusId || !claimText.trim()) return;

    setCreating(true);
    setError(null);
    setCreatedClaim(null);

    const result = await apiPost<ClaimResult>(`/api/corpus/${corpusId}/claims`, {
      text: claimText.trim(),
      anchor_ids: Array.from(selectedAnchorIds)
    });

    if (!result.ok) {
      setError(result.error);
    } else {
      setCreatedClaim(result.data);
      setClaimText("");
      setSelectedAnchorIds(new Set());
    }
    setCreating(false);
  };

  if (!corpusId) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans flex items-center justify-center">
        <p className="text-muted-foreground">No corpus_id provided.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">LANTERN</h1>
          </div>
          <p className="text-muted-foreground">Anchor Browser</p>
          <p className="text-xs font-mono text-muted-foreground mt-1" data-testid="corpus-id-display">
            corpus_id: {corpusId}
          </p>
        </header>

        {error && (
          <Card className="mb-6 border-red-500/30">
            <CardContent className="py-3 text-sm text-red-400">
              {error}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Filters</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">Role</label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger data-testid="filter-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">ALL</SelectItem>
                      <SelectItem value="PRIMARY">PRIMARY</SelectItem>
                      <SelectItem value="SECONDARY">SECONDARY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground block mb-1">Source</label>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger data-testid="filter-source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">ALL</SelectItem>
                      {sources.map(s => (
                        <SelectItem key={s.source_id} value={s.source_id}>
                          {s.filename}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Anchor className="w-4 h-4" />
                  Anchors
                  <span className="text-xs text-muted-foreground font-normal">({anchors.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : anchors.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No anchors found. Build anchors from the Intake screen.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {anchors.map(anchor => (
                      <div
                        key={anchor.id}
                        className={`p-3 border rounded cursor-pointer transition-colors ${
                          selectedAnchorIds.has(anchor.id)
                            ? "border-cyan-500 bg-cyan-500/10"
                            : "border-border hover:border-border/80"
                        }`}
                        onClick={() => toggleAnchor(anchor.id)}
                        data-testid={`anchor-row-${anchor.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedAnchorIds.has(anchor.id)}
                            onCheckedChange={() => toggleAnchor(anchor.id)}
                            data-testid={`anchor-checkbox-${anchor.id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm mb-1 line-clamp-2">{anchor.quote}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                {anchor.source_document}
                              </span>
                              <span>{anchor.page_ref}</span>
                              <span className="font-mono text-[10px]">{anchor.id.slice(0, 8)}</span>
                              <Link href={`/anchors/proof?anchorId=${anchor.id}`} onClick={(e) => e.stopPropagation()}>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-5 px-1.5 text-[10px]"
                                  data-testid={`anchor-proof-${anchor.id}`}
                                >
                                  <Eye className="w-3 h-3 mr-0.5" />
                                  View Proof
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-base">Claim Draft</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Claim text</label>
                  <Textarea
                    value={claimText}
                    onChange={e => setClaimText(e.target.value)}
                    placeholder="Enter claim text..."
                    className="min-h-[120px]"
                    data-testid="input-claim-text"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Selected anchors ({selectedAnchorIds.size})
                  </label>
                  <div className="text-xs font-mono text-muted-foreground max-h-[100px] overflow-y-auto">
                    {selectedAnchorIds.size === 0 ? (
                      <p className="italic">None selected</p>
                    ) : (
                      Array.from(selectedAnchorIds).map(id => (
                        <div key={id}>{id}</div>
                      ))
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleCreateClaim}
                  disabled={creating || !claimText.trim()}
                  className="w-full bg-cyan-600 hover:bg-cyan-500"
                  data-testid="button-create-claim"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Create Claim
                </Button>

                {createdClaim && (
                  <Card className="border-emerald-500/30 bg-emerald-500/5">
                    <CardContent className="py-4">
                      <p className="text-sm font-semibold text-emerald-400 mb-2">Claim Created</p>
                      <div className="text-xs font-mono text-muted-foreground space-y-1">
                        <p>id: {createdClaim.id}</p>
                        <p>classification: {createdClaim.classification}</p>
                        <p>confidence: {createdClaim.confidence}</p>
                      </div>
                      <Button
                        onClick={() => navigate(`/?corpusId=${corpusId}`)}
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        data-testid="button-go-to-claim-space"
                      >
                        Go to Claim Space
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

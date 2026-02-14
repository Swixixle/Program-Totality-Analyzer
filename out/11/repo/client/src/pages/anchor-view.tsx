import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Calendar, Hash, Layers, AlertCircle } from "lucide-react";
import type { Anchor } from "@/lib/schema/anchors";
import { apiGet } from "@/lib/auth";

function AnchorCard({ anchor }: { anchor: Anchor }) {
  return (
    <Card className="border-l-4 border-l-cyan-500" data-testid={`anchor-${anchor.id}`}>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start gap-2">
          <Hash className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <span className="text-xs font-mono text-muted-foreground">{anchor.id}</span>
        </div>
        
        <blockquote className="border-l-2 border-cyan-500/50 pl-3 italic text-sm bg-muted/30 p-3 rounded-r">
          "{anchor.quote}"
        </blockquote>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <FileText className="w-3 h-3 text-muted-foreground" />
            <span>{anchor.source_document}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{anchor.page_ref}</span>
            {anchor.section_ref && (
              <span className="text-muted-foreground">• {anchor.section_ref}</span>
            )}
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <span>{anchor.timeline_date}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnchorView() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const anchorIds = params.get("ids")?.split(",").filter(Boolean) || [];
  const claimId = params.get("claimId");
  const isEmpty = params.get("empty") === "true";

  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEmpty || anchorIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchAnchors = async () => {
      const result = await apiGet<{ anchors: Anchor[], missing_ids: string[] }>(`/api/anchors?ids=${anchorIds.join(",")}`);
      if (!result.ok) {
        setError(result.error);
      } else {
        setAnchors(result.data.anchors);
        setMissingIds(result.data.missing_ids);
      }
      setLoading(false);
    };

    fetchAnchors();
  }, [anchorIds.join(","), isEmpty]);

  const noAnchorsAvailable = isEmpty || (anchorIds.length === 0) || (anchors.length === 0 && !loading);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">LANTERN</h1>
          </div>
          
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Claim Space
            </Button>
          </Link>
          
          <h2 className="text-lg font-semibold">Evidence Anchors</h2>
          {claimId && (
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Claim: {claimId}
            </p>
          )}
          {anchorIds.length > 0 && !isEmpty && (
            <p className="text-xs text-muted-foreground mt-1">
              Requested: {anchorIds.length} anchor{anchorIds.length !== 1 ? "s" : ""} 
              {anchors.length > 0 && ` • Found: ${anchors.length}`}
            </p>
          )}
        </header>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 mb-6">
          <p className="text-sm font-medium text-amber-500">
            Any claim not anchored here is not defensible.
          </p>
        </div>

        {loading ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              <p className="text-sm">Loading anchors...</p>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-red-500/30">
            <CardContent className="py-8 text-center text-red-400">
              <AlertCircle className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm">{error}</p>
            </CardContent>
          </Card>
        ) : noAnchorsAvailable ? (
          <Card className="border-dashed" data-testid="no-anchors-message">
            <CardContent className="py-8 text-center text-muted-foreground">
              <p className="text-sm">No anchors available for this claim in the current corpus.</p>
              <p className="text-xs mt-2">This claim cannot be defended without supporting evidence.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {anchors.map((anchor) => (
              <AnchorCard key={anchor.id} anchor={anchor} />
            ))}
            
            {missingIds.length > 0 && (
              <Card className="border-amber-500/30 mt-6">
                <CardContent className="py-4">
                  <p className="text-xs text-amber-500">
                    {missingIds.length} anchor{missingIds.length !== 1 ? "s" : ""} not found in corpus: {missingIds.join(", ")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <footer className="mt-12 pt-6 border-t border-border/50 text-center text-xs text-muted-foreground">
          <p>No summaries. No interpretation. Verbatim only.</p>
        </footer>
      </div>
    </div>
  );
}
